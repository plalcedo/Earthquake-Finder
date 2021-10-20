let map;
let storage = window.localStorage;
let options = {
    position: "bottom-right",
    animationDuration: 300,
    maxNotifications: 3
}
let notifier = new AWN(options);

// Initialize the array with the cities, this means that everytime an user opens the app it will restart.
let cities = [];
storage.setItem('cities', JSON.stringify(cities));

function initMap() {
    document.getElementById("msg").classList.remove();
    document.getElementById("msg").innerText = "Type a city above to search for earthquakes, the map will display after that below this message.";
}

window.addEventListener('DOMContentLoaded', () => {

    // ---------------------- Events ---------------------- //

    // Search button
    document.getElementById("btnRequest").addEventListener('click', (event) => {
        event.preventDefault();
        document.getElementById("msg").innerText = "";
        const city = document.getElementById("city").value;

        if (city.length > 0) {
            searchCity(city, 1);
        } else {
            notifier.alert('Complete the field to search for a city.', options)
        }
    });

    // Search history link
    document.getElementById("btnSearchHistory").addEventListener('click', () => {
        searchHistory();
    });

    // Clear search history
    document.getElementById("btnClearHistory").addEventListener('click', () => {
        let citiesHistory = JSON.parse(localStorage.getItem("cities"));
        if (citiesHistory.length > 0) {
            let cities = [];
            storage.setItem('cities', JSON.stringify(cities));
            document.getElementById("btnCloseModal").click();
            let table = document.getElementById("tableBodyCities");
            table.innerHTML = "";
            notifier.success('Your search history was cleared.', options);
        } else {
            notifier.warning('Your search history is already empty.')
        }
    });

    document.getElementById("btnTop10").addEventListener('click', () => {
        // Call the Top 10 function
        searchTop10();
    })

    // ---------------------- Functions ---------------------- //

    // This function is the one in charge to search for the city boundaries, then it calls the createMap function
    // The variable save determines if it has to save the city in the search history or not

    async function searchCity(city, save) {
        // Sending the city to the Nominatim API, this one helps me to get the city bounding box coordinates (North, south, east and west)
        const nominatinResponse = await fetch(`https://nominatim.openstreetmap.org/search?city=${city}&format=json&limit=1&accept-language=en`);
        const cityInformation = await nominatinResponse.json();

        if (cityInformation.length == 0) {
            notifier.alert('Sorry, we could not find any city with that name.', options);
        } else {

            // Get the Bounding Box
            const south = cityInformation[0].boundingbox[0];
            const north = cityInformation[0].boundingbox[1];
            const west = cityInformation[0].boundingbox[2];
            const east = cityInformation[0].boundingbox[3];

            // Get the complete name for this city, for information purposes
            const displayName = cityInformation[0].display_name;

            // Calling the Geonames API to get the Earthquakes, I am saving my username for this service in a constant
            const username = 'plalcedo';
            const geonamesResponse = await fetch(`https://secure.geonames.org/earthquakesJSON?north=${north}&south=${south}&east=${east}&west=${west}&username=${username}`);
            const earthquakes = await geonamesResponse.json();
            const eartquakesLength = earthquakes.earthquakes.length;

            if (eartquakesLength == 0) {
                notifier.warning('There are not earthquakes to show in this city (' + city + '). Try with another one.', options);
            } else {
                // Plotting the earthquakes in the map
                notifier.success("Showing results for: " + displayName, options)
            }
            // Get the lat and lon
            const lat = Number(cityInformation[0].lat);
            const lon = Number(cityInformation[0].lon);

            // Creating the map 
            createMap(lat, lon, eartquakesLength, earthquakes);

            // Saving the city in the search history
            if (save == 1) {
                let citiesHistory = JSON.parse(localStorage.getItem("cities"));
                citiesHistory[citiesHistory.length] = city;
                storage.setItem('cities', JSON.stringify(citiesHistory));
            }
        }
    }


    // This function allows me to create the map and plot the markers

    function createMap(lat, lng, earthquakesLength, earthquakes) {
        const latLng = { lat: lat, lng: lng }
        map = new google.maps.Map(document.getElementById("map"), {
            center: latLng,
            zoom: 8,
        });

        for (let i = 0; i < earthquakesLength; i++) {
            // Get earthquake information
            let datetime = earthquakes.earthquakes[i].datetime;
            let depth = earthquakes.earthquakes[i].depth;
            let magnitude = earthquakes.earthquakes[i].magnitude;

            let lat = earthquakes.earthquakes[i].lat;
            let lng = earthquakes.earthquakes[i].lng;
            let position = { lat: lat, lng: lng }

            let marker = new google.maps.Marker({
                position: position,
                title: "Earthquake"
            });

            let infoWindow = new google.maps.InfoWindow({
                content: `
                        <h6>Information</h6>
                        <p>Date: ${datetime}</p>
                        <p>Magnitude: ${magnitude}</p>
                        <p>Depth: ${depth}</p>
                        <p>Position:</p>
                        <ul>
                            <li>Latitude: ${lat}</li>
                            <li>Longitude: ${lng}</li>
                        </ul>
                        `
            });

            marker.setMap(map);
            marker.addListener('click', () => {
                infoWindow.open(map, marker);
            });
        }
    }

    // This function works for the search history

    function searchHistory() {
        let citiesHistory = JSON.parse(localStorage.getItem("cities"));

        if (citiesHistory.length > 0) {
            document.getElementById("msgModal").innerText = "";

            // Algorithm to fill the table in the Search History section, also allow to search for that city again
            /*  Template:
                <tbody id="tableBodyCities">
                    <tr>
                        <td>City</td>
                        <td class="btn btn-primary icon"><i class="fas fa-search"></i></td>
                    </tr>
                </tbody>
            */

            let table = document.getElementById("tableBodyCities");
            table.innerHTML = "";

            for (let i = 0; i < citiesHistory.length; i++) {

                let row = `
                            <tr>
                                <td>${citiesHistory[i]}</td>
                                <td class="btn btn-primary btnSearch" data-id="${citiesHistory[i]}"><i class="fas fa-search" data-id="${citiesHistory[i]}"></i></td>
                            </tr>
                        `;
                table.innerHTML += row;

                // Add functionality to the buttons
                document.querySelectorAll(".btnSearch").forEach(btn => {
                    btn.addEventListener('click', (event) => {
                        let city = event.target.dataset.id;
                        searchCity(city, 0);
                        document.getElementById("city").value = city;
                        document.getElementById("btnCloseModal").click();
                    });
                });
            }

        } else {
            document.getElementById("msgModal").classList.add("text-danger");
            document.getElementById("msgModal").innerText = "There are no cities in the search history, try to go and search for a city and then come back here.";
        }
    }

    // This function searches for the Top 10 largest earthquakes

    async function searchTop10() {

        // Getting the actual date
        const date = new Date();
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const inputDate = `${year}-${month}-${day}`;

        // Bounding box coordinates for the entire world
        const north = 90;
        const south = -90;
        const east = 180;
        const west = -180;

        // Calling the Geonames API to get the Earthquakes, I am saving my username for this service in a constant
        const username = 'plalcedo';
        const maxRows = 500;
        const minMagnitude = 6;

        // Creating an object to save the earthquakes from the last 12 months
        let eq12Months = {
            eqArray: []
        };

        let top10 = eq12Months.eqArray;

        // Im going to look for the last 500 earthquakes (that is the API limit) with a min magnitude of 5, then I will filter them to clear all the ones out of date

        const geonamesResponse = await fetch(`https://secure.geonames.org/earthquakesJSON?north=${north}&south=${south}&east=${east}&west=${west}&maxRows=${maxRows}&date=${inputDate}&minMagnitude=${minMagnitude}&username=${username}`);
        const earthquakes = await geonamesResponse.json();

        const eq = earthquakes.earthquakes;

        for (let i = 0; i < eq.length; i++) {

            // The substring() method will allow me to get the first four digits of the datetime (those correspond to the year 
            // If the year is < than (year - 1), that earthquake does not count)
            const eqYear = Number(eq[i].datetime.substring(0, 4));

            if (eqYear < year - 1) {
                delete eq[i];
            } else if (eqYear == year - 1) {

                // If we are here, it means its the previous year, for example: 2021 => 2020. Now it is time to filter by month
                // If the month of the earthquake is < than the current month, a year has passed so the earthquake does not count
                // Now, the substring has to be (5,7) to get the month from datetime
                const eqMonth = Number(eq[i].datetime.substring(5, 7));

                if (eqMonth < month) {
                    delete eq[i];
                } else if (eqMonth == month) {

                    // If we are here, it means its the same month, for example: 10 == 10. Now it is time to filter by day 
                    // If the day is < than the current day, a year has passes so so the earthquake does not count
                    // Now, the substring has to be (8,10) to get the day from datetime

                    const eqDay = Number(eq[i].datetime.substring(8, 10));

                    if (eqDay < day) {
                        delete eq[i];
                    }
                }
            }

            if (eq[i] != undefined) {
                // Save the earthquake if it was not eliminated (that means it was in the last 12 months)
                top10.push(eq[i]);
            }
        }

        placingTop10(top10);
    }

    async function placingTop10(top10) {

        let table = document.getElementById("tableBodyTop10");
        table.innerHTML = "";

        // Sorting to get the Top 10
        top10.sort((a, b) => {
            return b.magnitude - a.magnitude;
        });

        console.log(top10);

        /*
            Template: Location, magnitude, date
            <ul>
                <li></li>
                <li></li>
                <li></li>
            </ul>
        */

        let asterisk = document.createElement("span");
        asterisk.innerHTML = "* ";
        let location = "";

        for (let i = 0; i < 10; i++) {
            let latitude = top10[i].lat;
            let longitude = top10[i].lng;

            const reverseGeocoding = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=AIzaSyDJO-dRDOFlfo7tQRdFb4sckxGw2G2lyHc&language=en`);
            const cityByLatLng = await reverseGeocoding.json();
            const resultLength = cityByLatLng.results.length;

            if (resultLength == 1) {
                location = asterisk.innerHTML + cityByLatLng.results[resultLength - 1].formatted_address;
            } else {
                location = cityByLatLng.results[resultLength - 1].formatted_address;
            }

            let magnitude = top10[i].magnitude;
            let date = top10[i].datetime;
            let row = `
                        <tr>
                            <td>${i+1}</td>
                            <td>${location} (${latitude}, ${longitude})</td>
                            <td>${magnitude}</td>
                            <td>${date}</td>
                        </tr>
                     `;
            table.innerHTML += row;
        }
    }
});