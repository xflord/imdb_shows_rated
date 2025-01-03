import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

// #f4c619 orange
// #121212 dark grey
// fonts - verdana, helvetica neue


//variable containing reference to data
var seriesData;
var episodesData;

let filteredShows;
const checkedState = {}; // Tracks the checked state of each checkbox
const selectedShows = new Set() // ids of selected shows
let selectedEpisode;
let seriesColors = {}

//D3.js canvases
var textArea;

var barChartArea;
let previousBarWidth;

d3.json('public/series.json')
    .then(function(data) {
        seriesData = data;
        d3.json('public/episodes.json')
            .then(function(data) {
                episodesData = data;

                init();
                visualization();
            })
    })

function init() {

    let color = d3.scaleOrdinal(d3.schemeTableau10 );

    Object.keys(seriesData).forEach(function(key) {
        seriesData[key]["Episodes"] = []
        selectedShows.add(seriesData[key].imdbID);
        checkedState[seriesData[key].imdbID] = true;
        // initiate colors
        seriesColors[key] = color(seriesData[key].Title)
    })
    Object.keys(episodesData).forEach(function(key) {
        var seriesId = episodesData[key].seriesID;
        if (String(seriesId).startsWith("tt")) {
            if (seriesData[seriesId] !== undefined) {
                seriesData[seriesId]["Episodes"].push(episodesData[key]);
            }
        } else {
            console.log("Series not fount for episode : " + key);
        }
    })
    renderCheckboxes(Object.keys(seriesData));
    document.getElementById('search').addEventListener('input', filterCheckboxes);

    // Set up modal closing
    var modal = d3.select("#myModal");
    d3.select(".close")
        .on("click", function() {
            modal.style("display", "none");
        })
    modal
        .on("click", function(e) {
            if (e.target === this) {
                modal.style("display", "none");
            }
        })

    textArea = d3.select("#text_div")
        .attr("width", d3.select("#text_div").node().clientWidth)
        .attr("height", d3.select("#text_div").node().clientHeight);

    barChartArea = d3.select("#barchart_div").append("svg")
        .attr("width", d3.select("#barchart_div").node().clientWidth)
        .attr("height", d3.select("#barchart_div").node().clientHeight)
        .style("overflow", "visible");
}

let checkAllState = false; // Track the state of the "Check All" checkbox
// Populate the checkbox list
// Populate the checkbox list
function renderCheckboxes(shows) {
    const checkboxList = document.getElementById('checkboxList');


    // Remove existing checkboxes (except "Check All")
    checkboxList.innerHTML = `
        <div class="checkbox-item">
          <input type="checkbox" id="checkAll" />
          <label for="checkAll"><strong>Check All</strong></label>
        </div>
      `;

    shows.forEach(show => {
        const div = document.createElement('div');
        div.className = 'checkbox-item';
        div.innerHTML = `
          <input 
            type="checkbox" 
            class="show-checkbox" 
            id="show-${seriesData[show].imdbID}" 
            value="${seriesData[show].Title}" 
            ${checkedState[seriesData[show].imdbID] ? 'checked' : ''} 
          />
          <label for="show-${seriesData[show].imdbID}">${seriesData[show].Title}</label>
        `;
        checkboxList.appendChild(div);
    });
    const checkAllCheckbox = document.getElementById('checkAll');
    // Rebind Check All functionality
    const checkboxes = document.querySelectorAll('.show-checkbox');
    checkAllCheckbox.addEventListener('change', () => {
        checkboxes.forEach(cb => {
            cb.checked = checkAllCheckbox.checked;
            const showId = cb.id.split('-')[1];
            checkedState[showId] = checkAllCheckbox.checked; // Update state
            if (cb.checked) {
                selectedShows.add(showId);
            } else {
                selectedShows.delete(showId);
            }
        });
        drawBarChart(selectedShows);
        drawRadarChart(selectedShows);
    });

    // Update individual checkboxes to toggle "Check All" state dynamically
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const showId = cb.id.split('-')[1];
            if (cb.checked) {
                selectedShows.add(showId);
            } else {
                selectedShows.delete(showId);
            }
            checkedState[showId] = cb.checked; // Persist state
            const allFilteredChecked = shows.every(show => checkedState[seriesData[show].imdbID]);
            const anyFilteredUnchecked = shows.some(show => !checkedState[seriesData[show].imdbID]);
            checkAllCheckbox.checked = allFilteredChecked;
            checkAllCheckbox.indeterminate = !allFilteredChecked && !anyFilteredUnchecked;
            drawBarChart(selectedShows);
            drawRadarChart(selectedShows);
        });
    });

    // Set the state of "Check All" based on filtered checkboxes
    const allFilteredChecked = shows.every(show => checkedState[seriesData[show].imdbID]);
    const anyFilteredUnchecked = shows.some(show => !checkedState[seriesData[show].imdbID]);
    checkAllCheckbox.checked = allFilteredChecked;
    checkAllCheckbox.indeterminate = !allFilteredChecked && !anyFilteredUnchecked;
}

// Filter function
function filterCheckboxes() {
    const searchTerm = document.getElementById('search').value.toLowerCase();
    filteredShows = Object.keys(seriesData).filter(show =>
        seriesData[show].Title.toLowerCase().includes(searchTerm)
    );
    renderCheckboxes(filteredShows);
}

function visualization() {

    drawTextInfo();
    drawBarChart(selectedShows);
    drawRadarChart(selectedShows);
}

function drawTextInfo() {
    //Draw headline
    d3.svg("public/logo.svg")
        .then((d) => {
            d3.select("#text_div").select("#title_div").node().append(d.documentElement)
            d3.select("#text_div").select("svg")
                .attr("id", "logo")
                .attr("x", 0)
                .attr("y", 0);
            textArea.select("#title_div").append("text")
                .attr("dx", 20)
                .attr("dy", "3em")
                .attr("class", "headline")
                .text("rating of popular TV shows");
            d3.select("#barchart_title").append('text')
                .attr("class", "headline")
                .text("Number of episodes rated above 9.5")
        })
}

function openShowDetail(show) {
    barChartArea
        .selectAll("*").interrupt()
    d3.select("#myModal")
        .style("display", "flex")

    // open window at the top
    const window = document.getElementById("modal_window")
    window.scrollTop = 0;

    drawLineChart(show);
}

function drawBarChart(shows) {
    barChartArea.selectAll("*").remove()
    let thisCanvasHeight = barChartArea.node().clientHeight * 0.7


    //gap size for heatmap row labels
    let labelWidth = (1 / 16) * barChartArea.node().clientWidth

    let showsWithEps = []

    shows.keys().forEach((key) => {
        if (seriesData[key].Episodes.filter((ep) => Number(ep.imdbRating) > 9.5 ).length > 0) {
            showsWithEps.push(key)
        }
    })

    //width of one bar/column of the heatmap
    let barWidth = showsWithEps.length > 0 ? ((7 / 8) * barChartArea.node().clientWidth) / showsWithEps.length : 0;

    let i = 0;
    let topNumberOfEps = d3.max(showsWithEps, (d) => seriesData[d].Episodes.filter((ep) => Number(ep.imdbRating) > 9.5 ).length)
    showsWithEps.sort()

    var tooltip = barChartArea.append("text")
        .style("opacity", 0)
        .attr("class", "tooltip")
        .style("font-size", "calc(1vw + 2vh)")

    var color = d3.scaleOrdinal(d3.schemeTableau10);

    // TODO barvy stale pro kazdou show -> az bude i druhy graf
    showsWithEps.forEach(key => {
        var barHeight = (seriesData[key].Episodes.filter((ep) => Number(ep.imdbRating) > 9.5 ).length / topNumberOfEps) * thisCanvasHeight;
        seriesColors[key] = color(key)
        if (barHeight > 0) {
            barChartArea.append('rect')
                .attr('id', key)
                .attr("class", "barChartBar")
                .attr("x", labelWidth + 10 + i * (previousBarWidth ?? 0))
                .attr("y", thisCanvasHeight - barHeight)
                .attr("height", barHeight)
                .attr("width", (previousBarWidth ?? 0) + 1)
                .attr("fill", seriesColors[key])
                .attr("fill-opacity", 0.7)
                .on("mouseover", function(d) {
                    d3.selectAll(".barChartBar")
                        .transition().duration(200)
                        .attr("fill-opacity", 0.3)
                    d3.select(this)
                        .transition().duration(200)
                        .attr("fill-opacity", 1)
                    tooltip
                        .style("opacity", 1)
                        .text(seriesData[key].Title)
                })
                .on("mouseout", function(d) {
                    d3.selectAll(".barChartBar")
                        .transition().duration(200)
                        .attr("fill-opacity", 0.7)
                    tooltip
                        .style("opacity", 0)
                })
                .on("mousemove", function(d) {
                    tooltip
                        .attr("x", d3.pointer(d)[0] + (d3.pointer(d)[0] + 300 > barChartArea.node().clientWidth ? -200 : 20))
                        .attr("y", d3.pointer(d)[1] - 40)
                        .raise()
                })
                .on("click", function () { openShowDetail(key); }) //registering the click event and folow up action
                .transition("loadingTransition") //transition animation
                    .duration(1000)
                    .attr("y", thisCanvasHeight - barHeight)//attributes after transition
                    .attr("x", labelWidth + 10 + i * barWidth)
                    .attr("width", barWidth + 1)
                    .attr("height", barHeight)
            i += 1;
        }
    })

    previousBarWidth = barWidth;


    const yscale = d3.scaleLinear()
        .domain([0, topNumberOfEps ?? 1])
        .range([thisCanvasHeight, 5]);

    barChartArea.append("g")
        .attr("transform", `translate(${labelWidth},0)`)
        .attr("class", "yaxis")
        .call(d3.axisLeft(yscale))

    // barChartArea.append("g")
    //     .attr("fill", "steelblue")
    //     .selectAll()
    //     .data(seriesData)
    //     .join("rect")
    //     .attr("x", (d) => x(d.Title))
    //     .attr("y", (d) => y(d.Episodes.filter((ep) => Number(ep.imdbRating) > 9.5 ).length))
    //     .attr("height", (d) => y(0) - y(d.Episodes.filter((ep) => Number(ep.imdbRating) > 9.5 ).length))
    //     .attr("width", (d) => x.bandwith())
}

function formatShowDataForRadar(shows) {
    var data = []

    shows.keys().forEach((key) => {
        let show = seriesData[key];
        if (show.Episodes.length > 0) {

            let bestEpRating = show.Episodes.reduce((max, episode) => Math.max(max, episode.imdbRating === "N/A" ? 0 : Number(episode.imdbRating)), 0)
            let worstEpRating = show.Episodes.reduce((min, episode) => Math.min(min, episode.imdbRating === "N/A" ? 10 : Number(episode.imdbRating)), Infinity)
            let showRating = show.imdbRating;
            let numberOfEpisodes = show.Episodes.filter((ep) => !isNaN(ep.imdbRating)).length;
            console.log(numberOfEpisodes);

            let averageEpRating = show.Episodes.reduce((sum, episode) => sum + (isNaN(episode.imdbRating) ? 0 : Number(episode.imdbRating)), 0) / numberOfEpisodes;
            data.push(
                {axis: [{axis: "Best Episode Rating", value: bestEpRating},
                    {axis: "Worst Episode Rating", value: worstEpRating},
                    {axis: "Average Episode Rating", value: averageEpRating},
                    {axis: "Show Rating", value: showRating},
                    {axis: "Number of Episodes", value: numberOfEpisodes}],
                 title: show.Title,
                    key: show.imdbID
                }
            )
        }
    })
    return data;
}

function drawRadarChart(shows) {
    var margin = {top: 80, right: 50, bottom: 200, left: 400},
        width = Math.min(700, window.innerWidth - 10)  - margin.right,
        height = Math.min(width, window.innerHeight  - 20);

//////////////////////////////////////////////////////////////
////////////////////////// Data //////////////////////////////
//////////////////////////////////////////////////////////////

    var data = formatShowDataForRadar(shows);
//////////////////////////////////////////////////////////////
//////////////////// Draw the Chart //////////////////////////
//////////////////////////////////////////////////////////////

    var color = (key) => seriesColors[key];

    var radarChartOptions = {
        w: width,
        h: height,
        margin: margin,
        maxValue: 0.5,
        levels: 5,
        roundStrokes: true,
        color: color,
        axis: ["Best Episode Rating", "Worst Episode Rating", "Average Episode Rating", "Show Rating", "Number of Episodes"]
    };
//Call function to draw the Radar chart
    RadarChart(".radarChart", data, radarChartOptions);
}

function drawLineChart(show) {
    d3.select("#linechart_div").selectAll("*").remove()
    const data = seriesData[show].Episodes;
    const width = 1600;
    const height = 1000;
    const marginTop = 100;
    const marginRight = 100;
    const marginBottom = 300;
    const marginLeft = 100;

    const seriesInfoDiv = d3.select("#linechart_div").append("div")
        .attr("class", "seriesInfo")
    seriesInfoDiv.append("text")
        .attr("class", "headline")
        .attr("id", "detail_header")
        .text(seriesData[show].Title)
    const contentBox = seriesInfoDiv.append("div")
        .attr("class", "seriesInfo")
        .style("display", "flex")
        .style("width", "100%")
    const leftContent = contentBox.append("div")
        .style("display", "flex")
        .style('flex-direction', 'column')
        .style("width", "50%")
        .style("text-align", "left")
        .style("margin-left", "2em")
    const rightContent = contentBox.append("div")
        .style("display", "flex")
        .style('flex-direction', 'column')
        .style("width", "50%")
        .style("text-align", "right")
        .style("margin-right", "2em")

    const summary = leftContent.append("p")
        .attr("class", "infoCategory")
    summary
        .append("text")
        .attr("class", "infoTitle")
        .text("Summary: " )
    summary.append("text")
        .text(seriesData[show].Plot)

    const genre = leftContent.append("p")
        .attr("class", "infoCategory")
    genre
        .append("text")
        .attr("class", "infoTitle")
        .text("Genre: " )
    genre.append("text")
        .text(seriesData[show].Genre)

    const writer = leftContent.append("p")
        .attr("class", "infoCategory")
    writer
        .append("text")
        .attr("class", "infoTitle")
        .text("Writer: " )
    writer.append("text")
        .text(seriesData[show].Writer)

    const rating = rightContent.append("p")
        .attr("class", "infoCategory")
    rating
        .append("text")
        .attr("class", "infoTitle")
        .text("Rating: " )
    rating.append("text")
        .text(seriesData[show].imdbRating)

    const awards = leftContent.append("p")
        .attr("class", "infoCategory")
    awards
        .append("text")
        .attr("class", "infoTitle")
        .text("Awards: " )
    awards.append("text")
        .text(seriesData[show].Awards)

    const seasons = rightContent.append("p")
        .attr("class", "infoCategory")
    seasons
        .append("text")
        .attr("class", "infoTitle")
        .text("Seasons: " )
    seasons.append("text")
        .text(seriesData[show].totalSeasons)

    const totalEpisodes = rightContent.append("p")
        .attr("class", "infoCategory")
    totalEpisodes
        .append("text")
        .attr("class", "infoTitle")
        .text("Episodes: " )
    totalEpisodes.append("text")
        .text(data.length)

    const avg = data.reduce((sum, episode) => sum + (isNaN(episode.imdbRating) ? 0 : Number(episode.imdbRating)), 0) / data.filter(ep => !isNaN(ep.imdbRating)).length;
    const averageEp = rightContent.append("p")
        .attr("class", "infoCategory")
    averageEp
        .append("text")
        .attr("class", "infoTitle")
        .text("Average episode rating: " )
    averageEp.append("text")
        .text(d3.format(".2f")(avg))





    const chartTitles = d3.select("#linechart_div").append("div")
        .attr("id", "linechartTitles")
        .attr("class", "headline")

    chartTitles.append("div")
        .style("font-size", "calc(0.7vw + 1vh)")
        .text("Episodes chronologically")
    chartTitles.append("div")
        .style("opacity", 0.5)
        .style("font-size", "calc(0.5vw + 0.5vh)")
        .text("(Click an episode below to load info)")


    // TODO add the series information into the content boxes, do the same for the selected series at the bottom,
    // TODO match the colors in the respective charts, maybe add series color to the overview dialog

    // sort episodes from earliest to latest
    data.sort(function (a, b) {
        if (a.Season === b.Season) {
            return a.Episode - b.Episode;
        }
        return a.Season - b.Season
    })

    selectedEpisode = data[0];

    const x = d3.scaleLinear()
        .domain([0, data.length - 1])
        .range([marginLeft, width - marginRight])
    const y = d3.scaleLinear()
        .domain([d3.min(data, (d) => d.imdbRating) - 0.2,10])
        .range([height - marginBottom, marginTop])

    const line = d3.line()
        .defined((d,i) => !isNaN(data[i].imdbRating))
        .x((d, i) => x(i))
        .y((d, i) => (y(Number(data[i].imdbRating))))

    const svg = d3.select("#linechart_div").append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto; height: intrinsic; margin-left: 1.7em; margin-bottom: calc(-5vh - 7vw");

    svg.append("g")
        .attr("transform", "translate(40,0)")
        .attr("class", "yaxis")
        .call(d3.axisLeft(y).ticks(4));


    svg.append("path")
        .attr("fill", "none")
        .attr("stroke", "#f4c619")
        .attr("stroke-width", 4)
        .attr("d", line(data));

    var tooltip = svg.append("text")
        .style("opacity", 0)
        .attr("class", "tooltip")
        .style("font-size", "calc(1vw + 1vh)")

    svg.selectAll("myCircles")
        .data(data)
        .join("circle")
        .attr("class", "epCircle")
        .attr("fill", (d) => d === selectedEpisode ? "#ffda5c" : "black")
        .attr("stroke", "#ffda5c")
        .attr("stroke-width", 3)
        .attr("cx", (d, i) => x(i))
        .attr("cy", (d, i) => y(Number(data[i].imdbRating)))
        .attr("r", (d,i) => !isNaN(data[i].imdbRating) ? 7 : 0)
        .on("mouseover", (d, ep) => {
            d3.select(d.target)
                .transition().duration(200)
                .attr("fill", "#ffda5c")
            tooltip
                .style("opacity", 1)
                .text(ep.imdbRating)
        })
        .on("mouseout", function(d, ep) {
            if (ep !== selectedEpisode) {
                d3.select(this)
                    .transition().duration(200)
                    .attr("fill", "black")
            }
            tooltip
                .style("opacity", 0)
                .text("")
        })
        .on("mousemove", (d) => {
            tooltip
                .attr("x", d3.pointer(d)[0])
                .attr("y", d3.pointer(d)[1] - 20)
                .raise()
        })
        .on("click", (d, ep) => {
            d3.selectAll(".epCircle")
                .transition().duration(200)
                .attr("fill", "black")
            d3.select(d.target)
                .transition().duration(200)
                .attr("fill", "#ffda5c")
            selectedEpisode = ep;
            loadEpisode()
            // scroll ep info into view
            const window = document.getElementById("modal_window")
            window.scrollTo({top: window.scrollHeight, behavior: "smooth"});
        })
    loadEpisode()
}

function loadEpisode() {
    d3.selectAll(".episodeInfo").remove();
    const episodeInfoDiv = d3.select("#linechart_div").append("div")
        .attr("class", "episodeInfo")
    episodeInfoDiv.append("text")
        .attr("class", "headline")
        .attr("id", "episodeInfoTitle")
        .text(selectedEpisode.Title)
    episodeInfoDiv.append("div")
        .attr("class", "headline")
        .style("opacity", 0.5)
        .style("font-size", "calc(0.5vw + 0.5vh)")
        .text(`Season ${selectedEpisode.Season} Episode ${selectedEpisode.Episode}`)
    const contentBoxEp = episodeInfoDiv.append("div")
        .attr("class", "episodeInfoDiv")
        .style("display", "flex")
        .style("width", "100%")
    const leftContentEp = contentBoxEp.append("div")
        .style("display", "flex")
        .style('flex-direction', 'column')
        .style("width", "50%")
        .style("text-align", "left")
        .style("margin-left", "2em")
    const rightContentEp = contentBoxEp.append("div")
        .style("display", "flex")
        .style('flex-direction', 'column')
        .style("width", "50%")
        .style("text-align", "right")
        .style("margin-right", "2em")

    const summary = leftContentEp.append("p")
        .attr("class", "infoCategory")
    summary
        .append("text")
        .attr("class", "infoTitle")
        .text("Summary: " )
    summary.append("text")
        .text(selectedEpisode.Plot)

    const director = leftContentEp.append("p")
        .attr("class", "infoCategory")
    director
        .append("text")
        .attr("class", "infoTitle")
        .text("Director: " )
    director.append("text")
        .text(selectedEpisode.Director)

    const actors = leftContentEp.append("p")
        .attr("class", "infoCategory")
    actors
        .append("text")
        .attr("class", "infoTitle")
        .text("Actors: " )
    actors.append("text")
        .text(selectedEpisode.Actors)

    const rating = rightContentEp.append("p")
        .attr("class", "infoCategory")
    rating
        .append("text")
        .attr("class", "infoTitle")
        .text("Rating: " )
    rating.append("text")
        .text(selectedEpisode.imdbRating)

    const runtime = rightContentEp.append("p")
        .attr("class", "infoCategory")
    runtime
        .append("text")
        .attr("class", "infoTitle")
        .text("Runtime: " )
    runtime.append("text")
        .text(selectedEpisode.Runtime)

    const released = rightContentEp.append("p")
        .attr("class", "infoCategory")
    released
        .append("text")
        .attr("class", "infoTitle")
        .text("Release date: " )
    released.append("text")
        .text(selectedEpisode.Released)

}


function RadarChart(id, data, options) {
    var cfg = {
        w: 600,				//Width of the circle
        h: 600,				//Height of the circle
        margin: {top: 20, right: 20, bottom: 20, left: 20}, //The margins of the SVG
        levels: 3,				//How many levels or inner circles should there be drawn
        maxValue: 0, 			//What is the value that the biggest circle will represent
        labelFactor: 1.25, 	//How much farther than the radius of the outer circle should the labels be placed
        wrapWidth: 60, 		//The number of pixels after which a label needs to be given a new line
        opacityArea: 0.35, 	//The opacity of the area of the blob
        dotRadius: 4, 			//The size of the colored circles of each blog
        opacityCircles: 0.1, 	//The opacity of the circles of each blob
        strokeWidth: 2, 		//The width of the stroke around each blob
        roundStrokes: false,	//If true the area and stroke will follow a round path (cardinal-closed)
        color: d3.scaleOrdinal(d3.schemeCategory10)	//Color function
    };

    //Put all of the options into a variable called cfg
    if('undefined' !== typeof options){
        for(var i in options){
            if('undefined' !== typeof options[i]){ cfg[i] = options[i]; }
        }//for i
    }//if

    var axisMaxValues = []
    options.axis.forEach((d, i) => {
        if (data.length > 0) {
            axisMaxValues.push(d3.max(data, item => item.axis[i].value));
        } else {
            axisMaxValues.push(1)
        }
    })

    //If the supplied maxValue is smaller than the actual one, replace by the max in the data

    var allAxis = (options.axis.map(function(i, j){return i})),	//Names of each axis
        total = allAxis.length,					//The number of different axes
        radius = Math.min(cfg.w/2, cfg.h/2), 	//Radius of the outermost circle
        Format = d3.format('.0%'),			 	//Percentage formatting
        angleSlice = Math.PI * 2 / total;		//The width in radians of each "slice"

    //Scale for the radius
    var scales = [

    ]
    Object.keys(axisMaxValues).forEach(function(d, i){
        scales.push(d3.scaleLinear()
            .range([0, radius])
            .domain([0, axisMaxValues[d]]))
    })

    /////////////////////////////////////////////////////////
    //////////// Create the container SVG and g /////////////
    /////////////////////////////////////////////////////////

    //Remove whatever chart with the same id/class was present before
    d3.select(id).select("svg").remove();

    //Initiate the radar chart SVG
    var svg = d3.select(id).append("svg")
        .attr("width",  cfg.w + cfg.margin.left + cfg.margin.right)
        .attr("height", cfg.h + cfg.margin.top + cfg.margin.bottom)
        .attr("class", "radar"+id)
        .style("overflow", "visible");
    //Append a g element
    var g = svg.append("g")
        .attr("transform", "translate(" + (cfg.w/2 + cfg.margin.left) + "," + (cfg.h/2 + cfg.margin.top) + ")");

    /////////////////////////////////////////////////////////
    ////////// Glow filter for some extra pizzazz ///////////
    /////////////////////////////////////////////////////////

    //Filter for the outside glow
    var filter = g.append('defs').append('filter').attr('id','glow'),
        feGaussianBlur = filter.append('feGaussianBlur').attr('stdDeviation','2.5').attr('result','coloredBlur'),
        feMerge = filter.append('feMerge'),
        feMergeNode_1 = feMerge.append('feMergeNode').attr('in','coloredBlur'),
        feMergeNode_2 = feMerge.append('feMergeNode').attr('in','SourceGraphic');

    /////////////////////////////////////////////////////////
    /////////////// Draw the Circular grid //////////////////
    /////////////////////////////////////////////////////////

    //Wrapper for the grid & axes
    var axisGrid = g.append("g").attr("class", "axisWrapper");

    //Draw the background circles
    axisGrid.selectAll(".levels")
        .data(d3.range(1,(cfg.levels+1)).reverse())
        .enter()
        .append("circle")
        .attr("class", "gridCircle")
        .attr("r", function(d, i){return radius/cfg.levels*d;})
        .style("fill", "#f4c619")
        .style("stroke", "#CDCDCD")
        .style("fill-opacity", cfg.opacityCircles)
        .style("filter" , "url(#glow)");

    //Text indicating at what % each level is
    axisGrid.selectAll(".axisLabel")
        .data(d3.range(1,(cfg.levels+1)).reverse())
        .enter().append("text")
        .attr("class", "axisLabel")
        .attr("x", 4)
        .attr("y", function(d){return -d*radius/cfg.levels;})
        .attr("dy", "0.4em")
        .style("font-size", "10px")
        .attr("fill", "white")
        .text(function(d,i) { return Format(1 * d/cfg.levels); });

    /////////////////////////////////////////////////////////
    //////////////////// Draw the axes //////////////////////
    /////////////////////////////////////////////////////////

    //Create the straight lines radiating outward from the center
    var axis = axisGrid.selectAll(".axis")
        .data(allAxis)
        .enter()
        .append("g")
        .attr("class", "axis");
    //Append the lines
    axis.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", function(d, i){ return scales[i](axisMaxValues[i]*1.1) * Math.cos(angleSlice*i - Math.PI/2); })
        .attr("y2", function(d, i){ return scales[i](axisMaxValues[i]*1.1) * Math.sin(angleSlice*i - Math.PI/2); })
        .attr("class", "line")
        .style("stroke", "white")
        .style("stroke-width", "2px");

    //Append the labels at each axis
    axis.append("text")
        .attr("class", "legend")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("x", function(d, i){ return scales[i](axisMaxValues[i] * cfg.labelFactor) * Math.cos(angleSlice*i - Math.PI/2); })
        .attr("y", function(d, i){ return scales[i](axisMaxValues[i] * cfg.labelFactor) * Math.sin(angleSlice*i - Math.PI/2); })
        .text(function(d){return d})
        .call(wrap, cfg.wrapWidth);

    /////////////////////////////////////////////////////////
    ///////////// Draw the radar chart blobs ////////////////
    /////////////////////////////////////////////////////////

    //The radial line function
    var radarLine = d3.lineRadial().curve(d3.curveBasisClosed)
        .radius(function(d, i) { return scales[i](d.value); })
        .angle(function(d,i) {	return i*angleSlice; });

    if(cfg.roundStrokes) {
        radarLine.curve(d3.curveCardinalClosed);
    }

    //Create a wrapper for the blobs
    var blobWrapper = g.selectAll(".radarWrapper")
        .data(data)
        .enter().append("g")
        .attr("class", "radarWrapper");

    //Append the backgrounds


    var Tooltip = g.append("text")
        .style("opacity", 0)
        .attr("class", "tooltip")
        .style("font-size", "calc(1vw + 2vh)")
        .text("test")

    blobWrapper
        .append("path")
        .attr("class", "radarArea")
        .attr("d", function(d,i) { return radarLine(d.axis); })
        .style("fill", function(d,i) { return cfg.color(d.key); })
        .style("fill-opacity", cfg.opacityArea)
        .on('mouseover', function (d,i){
            //Dim all blobs
            d3.selectAll(".radarArea")
                .transition().duration(200)
                .style("fill-opacity", 0.1);
            //Bring back the hovered over blob
            d3.select(this)
                .transition().duration(200)
                .style("fill-opacity", 0.7);
            Tooltip
                .style("opacity", 1)
                .text(i.title)
        })
        .on("mousemove", function(d) {
            Tooltip
                .attr("x", d3.pointer(d)[0] + 20)
                .attr("y", d3.pointer(d)[1] - 40)
                .raise()
        })
        .on('mouseout', function(){
            //Bring back all blobs
            d3.selectAll(".radarArea")
                .transition().duration(200)
                .style("fill-opacity", cfg.opacityArea);
            Tooltip
                .style("opacity", 0)
        })
        .on("click", function(d, i) {
            openShowDetail(i.key)
        });

    //Create the outlines
    blobWrapper.append("path")
        .attr("class", "radarStroke")
        .attr("d", function(d,i) { return radarLine(d); })
        .style("stroke-width", cfg.strokeWidth + "px")
        .style("stroke", function(d,i) { return cfg.color(d.key); })
        .style("fill", "none")
        .style("filter" , "url(#glow)");

    //Append the circles
    blobWrapper.selectAll(".radarCircle")
        .data(function(d,i) { return d; })
        .enter().append("circle")
        .attr("class", "radarCircle")
        .attr("r", cfg.dotRadius)
        .attr("cx", function(d,i){ return scales[i](d.value) * Math.cos(angleSlice*i - Math.PI/2); })
        .attr("cy", function(d,i){ return scales[i](d.value) * Math.sin(angleSlice*i - Math.PI/2); })
        .style("fill", function(d,i,j) { return cfg.color(d.key); })
        .style("fill-opacity", 0.8);

    /////////////////////////////////////////////////////////
    //////// Append invisible circles for tooltip ///////////
    /////////////////////////////////////////////////////////

    //Wrapper for the invisible circles on top
    var blobCircleWrapper = g.selectAll(".radarCircleWrapper")
        .data(data)
        .enter().append("g")
        .attr("class", "radarCircleWrapper");

    //Append a set of invisible circles on top for the mouseover pop-up
    blobCircleWrapper.selectAll(".radarInvisibleCircle")
        .data(function(d,i) { return d; })
        .enter().append("circle")
        .attr("class", "radarInvisibleCircle")
        .attr("r", cfg.dotRadius*1.5)
        .attr("cx", function(d,i){ return scales[i](d.value) * Math.cos(angleSlice*i - Math.PI/2); })
        .attr("cy", function(d,i){ return scales[i](d.value) * Math.sin(angleSlice*i - Math.PI/2); })
        .style("fill", "none")
        .style("pointer-events", "all")
        .on("mouseover", function(d,i) {
            var newX =  parseFloat(d3.select(this).attr('cx')) - 10;
            var newY =  parseFloat(d3.select(this).attr('cy')) - 10;

            tooltip
                .attr('x', newX)
                .attr('y', newY)
                .text(i.value)
                .transition().duration(200)
                .style('opacity', 1);
        })
        .on("mouseout", function(){
            tooltip.transition().duration(200)
                .style("opacity", 0);
        });

    //Set up the small tooltip for when you hover over a circle
    var tooltip = g.append("text")
        .attr("class", "tooltip")
        .style("opacity", 0);

    /////////////////////////////////////////////////////////
    /////////////////// Helper Function /////////////////////
    /////////////////////////////////////////////////////////

    //Taken from http://bl.ocks.org/mbostock/7555321
    //Wraps SVG text
    function wrap(text, width) {
        text.each(function() {
            var text = d3.select(this),
                words = text.text().split(/\s+/).reverse(),
                word,
                line = [],
                lineNumber = 0,
                lineHeight = 1.4, // ems
                y = text.attr("y"),
                x = text.attr("x"),
                dy = parseFloat(text.attr("dy")),
                tspan = text.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");

            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (tspan.node().getComputedTextLength() > width) {
                    line.pop();
                    tspan.text(line.join(" "));
                    line = [word];
                    tspan = text.append("tspan").attr("x", x).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
                }
            }
        });
    }//wrap

}//RadarChart




