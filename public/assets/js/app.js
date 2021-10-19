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

    // ----------- Events ----------- //

    // Search button
    document.getElementById("btnRequest").addEventListener('click', (event) => {
        event.preventDefault();
        document.getElementById("msg").innerText = "";
        const city = document.getElementById("city").value;

        if (city.length > 0) {
            searchCity(city);
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
            notifier.success('Your search history was successful cleared.', options);
        } else {
            notifier.warning('Your search history is already empty.')
        }
    });

    // Call the Top10 function
    searchTop10();

    // ----------- Functions ----------- //

    // This function is the one in charge to search for the city boundaries, then it calls the createMap function

    async function searchCity(city) {
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
            const geonamesResponse = await fetch(`http://api.geonames.org/earthquakesJSON?north=${north}&south=${south}&east=${east}&west=${west}&username=${username}`);
            const earthquakes = await geonamesResponse.json();
            const eartquakesLength = earthquakes.earthquakes.length;

            if (eartquakesLength == 0) {
                notifier.warning('There are not earthquakes to show in this city (' + city + '). Try with another one.', options);
            } else {
                // Plotting the earthquakes in the map
                notifier.success("Showing results for: " + displayName, options)

                // Get the lat and lon
                const lat = Number(cityInformation[0].lat);
                const lon = Number(cityInformation[0].lon);

                // Creating the map 
                createMap(lat, lon, eartquakesLength, earthquakes);

                // Saving the city in the search history
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

            // Im gonna code here an algorithm to fill the table in the Search History section, and also allow to search for that city again
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
                        searchCity(city);
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
        const date = new Date();
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const inputDate = `${year}-${month}-${day}`;
        const maxRows = null;

        // Bounding box coordinates fot the entire world
        const north = 85;
        const south = -85;
        const east = 180;
        const west = -180;

        // Calling the Geonames API to get the Earthquakes, I am saving my username for this service in a constant
        const username = 'plalcedo';
        const geonamesResponse = await fetch(`http://api.geonames.org/earthquakesJSON?north=${north}&south=${south}&east=${east}&west=${west}&date=${inputDate}&username=${username}`);
        const earthquakes = await geonamesResponse.json();

        console.log(earthquakes);
    }

});