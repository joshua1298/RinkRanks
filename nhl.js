const statCache = {} //used to cache results to limit api calls, stores each standings call
let teamsArray
const todayObject = "December 11, 2024"
//const todayObject = new Date()
let chart = null //variable to store chart object

if(document.URL.includes("index.html")){
    run()
}



async function run(){
    const start = performance.now();

    let week = document.getElementById("week")
    week.textContent = "Week " + await getWeekNumber(todayObject)
    await populateTable(4)
    const end  = performance.now()
    console.log("Time: " + ((end - start) / 1000))
    document.getElementById("buffer").style.color = "black"
    document.getElementById("buffer").style.fontSize = "16px"

}



//fill the table with relevant data
async function populateTable(weeksBack){
    
    teamsArray = await calculateScores(weeksBack)
    
    //get todays standings
    let apiCall = "https://corsproxy.io/?https://api-web.nhle.com/v1/standings/2024-11-18"
    const todayStandings = await getInfo(apiCall)

    //get standings x weeks back
    apiCall = "https://corsproxy.io/?https://api-web.nhle.com/v1/standings/" + getWeeksBackDate(weeksBack)
    const pastStandings = await getInfo(apiCall)



    //fill each row
    for(let i = 0; i<32; i++){
        fillRow(i, todayStandings, pastStandings)
    }

}


async function fillRow(i, today, past){

    const teamName = teamsArray[i].name

    //current place in standings
    let currentPlace = 0
    for(let i = 0; i<32; i++){
        if(teamName === today.standings[i].teamAbbrev.default)
            currentPlace = i 
    }

    //place in standings x weeks ago
    let pastPlace = 0
    for(let i = 0; i<32; i++){
        if(teamName === past.standings[i].teamAbbrev.default)
            pastPlace = i 
    }

    //grab current row
    const row = document.querySelector(`tr[data-rank="${(i+1)}"]`)

    //assign all the rows children
    const [rank, team, score, cumuScore, gamesPlayed, wins, losses, otloss, diff] = row.children
    
    //add team picture
    team.querySelector("img").src = today.standings[currentPlace].teamLogo
    
    //build team name
    team.querySelector("span").textContent = today.standings[currentPlace].placeName.default + " " 
        + today.standings[currentPlace].teamCommonName.default

    //score column
    

    //turn score cell into a button that links to the chart
    const button = document.createElement("button")
    button.textContent = (teamsArray[i].score).toFixed(3)
    button.onclick = () => {
        //window.location.href = "chart.html"
        //getGraphData(today.standings[currentPlace].teamCommonName.default, 1, 4, 1)

        const params = {
            name: today.standings[currentPlace].teamAbbrev.default,
            xaxis: 1,
            weeks: 4,
            cumulative: 1
        }

        localStorage.setItem("chartParams", JSON.stringify(params))

        window.location.href = "chart.html"
    }
    score.appendChild(button)

    //cumuScore column 
    cumuScore.textContent = (teamsArray[i].oppStrengthCounter / (today.standings[currentPlace].gamesPlayed - past.standings[pastPlace].gamesPlayed)).toFixed(3)
    console.log(teamsArray)
    //GP column
    gamesPlayed.textContent = today.standings[currentPlace].gamesPlayed - past.standings[pastPlace].gamesPlayed

    //Wins column
    wins.textContent = today.standings[currentPlace].wins - past.standings[pastPlace].wins

    //Losses Column
    losses.textContent = today.standings[currentPlace].losses - past.standings[pastPlace].losses

    //OT losses column
    otloss.textContent = today.standings[currentPlace].otLosses - past.standings[pastPlace].otLosses
    
    //calculate goal diff of the specific time span
    let timeSpanGoalDiff = today.standings[currentPlace].goalDifferential - past.standings[pastPlace].goalDifferential

    //color text accordingly
    if(timeSpanGoalDiff > 0){
        diff.textContent = "+" + timeSpanGoalDiff
        diff.style.color = "green"
    }else if(timeSpanGoalDiff < 0){
        diff.textContent = timeSpanGoalDiff
        diff.style.color = "red"
    }else{
        diff.textContent = timeSpanGoalDiff
        diff.style.color = "black"
    }

   
    
}

//calculate the team scores based on how many weeks back
async function calculateScores(weeksBack){
    
    const today = new Date(todayObject)
    const dayIterator = new Date(todayObject) //where to calculate score from based on the parameter (default is 4 weeks back)
    dayIterator.setDate(today.getDate() - (weeksBack*7)) //set dayIterator to the date that is x weeks back

    let teamArray = [] //array of each team object

    //promise mess mumbo jumbo
    const promises = [] //stores every api call

    //gets the scoreboards for each day
    for(let i = 0; i<(weeksBack * 7); i++){
        const apiCall = "https://corsproxy.io/?https://api-web.nhle.com/v1/score/" + convertDateYearFirst(dayIterator)
        promises.push(getInfo(apiCall)) //store api call into array
        dayIterator.setDate(dayIterator.getDate() + 1) //icrement iterator
    }
    dayIterator.setDate(today.getDate() - (weeksBack*7)) //set iterator back to normal


    const yesterday = new Date(dayIterator) //declare yesterday outside for loop for later access
    let yesterdayString = "" //string for api calls and caching
    //gets the standings for each day
    for(let i = 0; i<(weeksBack * 7); i++){
        yesterday.setDate(dayIterator.getDate() - 1) //sets yesterday to one day behind the iterator
        yesterdayString = convertDateYearFirst(yesterday) //gets string version
        
        const apiCall = "https://corsproxy.io/?https://api-web.nhle.com/v1/standings/" + yesterdayString
        promises.push(getInfo(apiCall)) //store api call to array

        yesterday.setDate(yesterday.getDate() + 1) //increment
    }
    yesterday.setTime(dayIterator.getTime()) //reset yesterday

    const results = await Promise.all(promises) //resolve every promise into an array
    const gamesList = [] //for each scoreboard

    //store first half of results in gameList, store second half in statCache
    for(let o = 0; o<(weeksBack * 7 * 2 ); o++){
        if(o < (weeksBack * 7)){
            gamesList[o] = results[o]
        }else{
            yesterdayString = convertDateYearFirst(yesterday)
            if(!statCache[yesterdayString]){
                statCache[yesterdayString] = results[o]
            }
            yesterday.setDate(yesterday.getDate() + 1)
        }
    }

    for(let i = 0; i<(weeksBack * 7); i++){ //iterates through every day in x weeks
        for(let j = 0; j<gamesList[i].games.length; j++){ //iterates through every game on a date
            let homeScore = 0.0
            const homeName = gamesList[i].games[j].homeTeam.abbrev

            let awayScore = 0.0
            const awayName = gamesList[i].games[j].awayTeam.abbrev

            let isOt = false
            let homeWin = true

            //check if the game is OT
            if(gamesList[i].games[j].gameOutcome.lastPeriodType != "REG"){
                isOt = true
            }

            //checks who won the game
            if(gamesList[i].games[j].awayTeam.score > gamesList[i].games[j].homeTeam.score){
                homeWin = false
            }

            //Getting base scores
            if(homeWin && !isOt){
                homeScore += 3
                awayScore -= 1
            }else if(homeWin && isOt){
                homeScore += 2
                awayScore -= 0.5
            }else if(!homeWin && !isOt){
                awayScore += 3
                homeScore -= 1
            }else if(!homeWin && isOt){
                awayScore += 2
                homeScore -= 0.5
            }

            let homeStrength = 0
            let awayStrength = 0

            //get last week ranks for each team
            const homeOppStrength =  await getRankModifier(dayIterator, awayName, homeWin, awayStrength)
            const awayOppStrength = await getRankModifier(dayIterator, homeName, !homeWin, homeStrength)

            homeScore *= homeOppStrength[1]
            awayScore *= awayOppStrength[1]

            //Goal Differential calculation
            const goalDiff = Math.abs(gamesList[i].games[j].homeTeam.score - gamesList[i].games[j].awayTeam.score)
            switch(goalDiff){
                case 0:
                case 1:
                    break;
                case 2:
                    homeScore += homeWin ? 0.2 : -0.2
                    awayScore += homeWin ? -0.2 : 0.2
                    break;
                case 3:
                    homeScore += homeWin ? 0.3 : -0.3
                    awayScore += homeWin ? -0.3 : 0.3
                    break;
                default:
                    homeScore += homeWin ? 0.4 : -0.4
                    awayScore += homeWin ? -0.4 : 0.4
                    break;
            }
            
            //Home/away context bonus
            if(!homeWin){
                homeScore -= 0.2
                awayScore += 0.2
            }

            //update or add homeTeamObject
            const homeTeamObject = teamArray.find(obj => obj.name === homeName)
            if(!homeTeamObject){
                teamArray.push({
                    name: homeName,
                    score: homeScore,
                    oppStrengthCounter: homeOppStrength[0],
                })
            }else{
                homeTeamObject.score += homeScore
                homeTeamObject.oppStrengthCounter += homeOppStrength[0]
            }

            //update or add awayTeamObject
            const awayTeamObject = teamArray.find(obj => obj.name === awayName)
            if(!awayTeamObject){
                teamArray.push({
                    name: awayName,
                    score: awayScore,
                    oppStrengthCounter: awayOppStrength[0],
                })
            }else{
                awayTeamObject.score += awayScore
                awayTeamObject.oppStrengthCounter += awayOppStrength[0]

            }
        }
        dayIterator.setDate(dayIterator.getDate() + 1)
    }

    return teamArray.sort((a, b) => b.score - a.score)
}

//get the rank of the opponent and return the modifier
async function getRankModifier(date, opp, didWin){
    
    returnArray = []

    const yesterday = new Date(date)
    yesterday.setDate(date.getDate() - 1)
    let yesterdayString = convertDateYearFirst(yesterday)

    //cache miss
    if(!statCache[yesterdayString]){ 
        apiCall = "https://corsproxy.io/?https://api-web.nhle.com/v1/standings/" + yesterdayString
        const standings = await getInfo(apiCall)
        statCache[yesterdayString] = standings
    }
    
    const standingsObject = statCache[yesterdayString]
    
    let teamRank = 0

    //find team rank
    for(let i = 0; i<32; i++){
        if(opp === standingsObject.standings[i].teamAbbrev.default){
            teamRank = standingsObject.standings[i].leagueSequence
            break;
        }
    }

    let strength = (33 - teamRank) / 32
    returnArray.push(strength)

    //based on win or loss, return the correct opponent strength modifier
    if(teamRank >= 1 && teamRank <= 5)
        returnArray.push(didWin ? 1.2 : 0.95)
    else if(teamRank >= 6 && teamRank <= 10)
        returnArray.push(didWin ? 1.1 : 0.95)
    else if(teamRank >= 11 && teamRank <= 21)
        returnArray.push(1)
    else if(teamRank >= 22 && teamRank <= 27)
        returnArray.push(didWin ? 1 : 1.1)
    else if(teamRank >= 28 && teamRank <= 32)
        returnArray.push(didWin ? 1 : 1.1)
    else
        returnArray.push("This function is broken")

    return returnArray

}

//converts js date object format into NHL api date format (YYYY-MM-DD)
function convertDateYearFirst(date){        
    let stringDate = date.getFullYear()

    if(date.getMonth() + 1 < 10){
        stringDate += "-0" + (date.getMonth() + 1)
    }else{
        stringDate += "-" + (date.getMonth() + 1)
    }

    if(date.getDate() < 10){
        stringDate += "-0" + date.getDate()
    }else{
        stringDate += "-" + date.getDate()
    }

    return stringDate
}

//retruns the date that is X weeks back from today in NHL api format YYYY-MM-DD
function getWeeksBackDate(weeksBack){
    const today = new Date(todayObject)
    const pastDate = new Date(todayObject)
    pastDate.setDate(today.getDate() - (weeksBack * 7))

    return convertDateYearFirst(pastDate)
}

//updates week counter in the masthead
async function getWeekNumber(stringDate){
    
    const months = {
        0: "January",
        1: "February",
        2: "March",
        3: "April",
        4: "May",
        5: "June",
        6: "July",
        7: "August",
        8: "September",
        9: "October",
        10: "November",
        11: "December"
    }
    
    const apiCall = "https://corsproxy.io/?https://api-web.nhle.com/v1/schedule/now"
    const info = await getInfo(apiCall)

    const seasonStartYear = parseInt(info.regularSeasonStartDate)
    const seasonStartMonth = months[parseInt(info.regularSeasonStartDate.substring(5, 7)) - 1]
    const seasonStartDay = parseInt(info.regularSeasonStartDate.substring(8))
    

    const date = new Date()
    if(typeof today === "string"){
        date.setFullYear(stringDate.substring(0, 4))
        date.setMonth(stringDate.substring(5, 7))
        date.setDate(stringDate.substring(8))
    }

    const seasonStart = new Date(seasonStartMonth+" "+seasonStartDay+", "+seasonStartYear)
    
    let counter = 0
    let weekNumber = 0
    if(date>=seasonStart){
       while(date.getMonth() != seasonStart.getMonth() || date.getDate() != seasonStart.getDate() || date.getFullYear() != seasonStart.getFullYear()){
            date.setDate(date.getDate() - 1)
            counter++
        }
        weekNumber = Math.round((counter / 7) + 0.5)
    }
    
    
    return weekNumber

}

async function getInfo(apiCall){
    try{
        const responsetime = await fetch(apiCall)    
        const responsetimejson = await responsetime.json()
        console.log(responsetimejson)
        return responsetimejson
    }
    catch(error){
        console.error(error)
    }
}



function sendChartParams(){
    //create variable for each chart element
    const teamElement = document.getElementById("team")
    const team = teamElement.value
    const xaxisElement = document.getElementById("xaxis")
    const xaxis = xaxisElement.value == 1 ? true : false
    const weeksElement = document.getElementById("weekBack")
    const weeks = weeksElement.value
    const accumulateElement = document.getElementById("accumulate")
    const cumulative = accumulateElement.value === "1" ? true : false
    getGraphData(team, xaxis, weeks, cumulative)
    
}

async function getGraphData(team, xaxis, weeks, cumulative){

    

    const day = new Date(todayObject)
    const sunday = day.getDay()
    day.setDate(day.getDate() - sunday)
    console.log(day)
    day.setDate(day.getDate() - (weeks*7))
    console.log(day)

    //gets all api calls for each weekly schedule and does them all at once
    promises = []
    for(let i = 0; i<=Number.parseInt(weeks, 10); i++){
        const apiCall = "https://corsproxy.io/?https://api-web.nhle.com/v1/club-schedule/"+ team +"/week/"+ convertDateYearFirst(day)
        promises.push(getInfo(apiCall))
        day.setDate(day.getDate() + 7)
        console.log(i)
        console.log(day)
    }
    const schedules = await Promise.all(promises)
    

    //gets the standings for each day there was a game, makes all the api calls at once
    promisesStands = []
    gameScoreDates = {}
    for(let i = 0; i<schedules.length; i++){
        for(let j = 0; j<schedules[i].games.length; j++){
            const game = schedules[i].games[j]
            const apiCall = "https://corsproxy.io/?https://api-web.nhle.com/v1/standings/" + game.gameDate
            promisesStands.push(getInfo(apiCall))
            if(game.gameState === "OFF")
                gameScoreDates[game.gameDate] = {}

        }
    }
    const stands = await Promise.all(promisesStands)



    // calculates the score for each game and stores it in the gameScoreDates object
    let gameNum = 0
    for(let i = 0; i<schedules.length; i++){
        for(let j = 0; j<schedules[i].games.length; j++){
            const game = schedules[i].games[j]
            if(game.gameState === "OFF"){
                gameNum++
                calculcateGameScore(game, team, gameScoreDates, stands, cumulative, gameNum, xaxis)
            }
        }
    }

    drawChart(gameScoreDates, cumulative, xaxis, Number.parseInt(weeks, 10))
    loadSideInfo(gameScoreDates, stands, team)

}


function calculcateGameScore(game, code, gameObject, stands, accum, gameNum, xaxis){
    const object = gameObject[game.gameDate]
    let score = 0
    let isHome = (game.homeTeam.abbrev === code)
    let outcome = game.homeTeam.score - game.awayTeam.score
    outcome *= isHome ? 1 : -1
    const victory = (outcome > 0)

    object.win = victory
    object.home = isHome
    object.myScore = isHome ? game.homeTeam.score : game.awayTeam.score
    object.oppScore = isHome ? game.awayTeam.score : game.homeTeam.score
    

    if(game.gameOutcome.lastPeriodType === "REG"){
        object.gameType = "REG"
        if(victory)
            score = 3
        else
            score = -1
    }else{
        object.gameType = "OT"
        if(victory)
            score = 2
        else
            score = -0.5
    }

    //nested loops to get the opponents rank this game
    for(let i = 0; i<stands.length; i++){ //loop through list of objects (standings at each game date)
        if(game.gameDate === stands[i].standings[0].date){ //find the date of this game and the standings that go with it
            for(let j = 0; j<stands[i].standings.length; j++){ //look through those standings
                object.oppName = isHome ? game.awayTeam.abbrev : game.homeTeam.abbrev //get opp name
                object.oppLogo = isHome ? game.awayTeam.logo : game.homeTeam.logo
                if(object.oppName === stands[i].standings[j].teamAbbrev.default){ //find opp 
                    object.oppRank = stands[i].standings[j].leagueSequence //store opp rank in object
                    break
                }
            }
        }
    }

    //nested loops to get my rank this game
    for(let i = 0; i<stands.length; i++){ //loop through list of objects (standings at each game date)
        if(game.gameDate === stands[i].standings[0].date){ //find the date of this game and the standings that go with it
            for(let j = 0; j<stands[i].standings.length; j++){ //look through those standings
                object.myName = isHome ? game.homeTeam.abbrev : game.awayTeam.abbrev //get opp name
                object.myLogo = isHome ? game.homeTeam.logo : game.awayTeam.logo
                if(object.myName === stands[i].standings[j].teamAbbrev.default){ //find opp 
                    object.myRank = stands[i].standings[j].leagueSequence //store opp rank in object
                    break
                }
            }
        }
    }

    //uses opp rank to find strength modifier and apply it to score
    let modifier = 1
    if(object.oppRank >= 1 && object.oppRank <= 5)
        modifier = victory ? 1.2 : 0.95
    else if(object.oppRank >= 6 && object.oppRank <= 10)
        modifier = victory ? 1.1 : 0.95
    else if(object.oppRank >= 11 && object.oppRank <= 21)
        modifier = 1
    else if(object.oppRank >= 22 && object.oppRank <= 27)
        modifier = victory ? 1 : 1.1
    else if(object.oppRank >= 28 && object.oppRank <= 32)
        modifier = victory ? 1 : 1.1

    score *= modifier //update score with strength modifier

    //get  goal diff bonus
    if(outcome < 0){
        switch(outcome){
            case -1:
                break
            case -2:
                score -= 0.2
                break
            case -3:
                score -= 0.3
                break
            default:
                score -=0.4
                break
        }
    }else{
        switch(outcome){
            case 0:
            case 1:
                break
            case 2:
                score += 0.2
                break
            case 3:
                score += 0.3
                break
            default:
                score += 0.4
                break
        }
    }

    // get home/away context and adjsut accordingly (road win, home loss)
    if(!isHome && victory){
        score += 0.2
    }else if(isHome && !victory){
        score -= 0.2
    }
    
    if(accum){
        const keys = Object.keys(gameObject)
        if(gameObject[keys[gameNum-2]])
            object.accumScore = score + gameObject[keys[gameNum-2]].accumScore
        else
            object.accumScore = score
    }
    object.score = score

    
    
} 

async function drawChart(dataObject, accum, xaxis, weeks){


    const weekly = {}
    if(xaxis){
        const dates = Object.keys(dataObject)
        const rangeStart = new Date(todayObject)
        rangeStart.setDate(rangeStart.getDate() - (weeks+1) * 7)

        for(let i = 0; i<= (weeks+1) * 7; i++){
            
            if(rangeStart.getDay() === 0){
                const prevSunday = new Date(rangeStart)
                prevSunday.setDate(prevSunday.getDate() - 7)
                weekly[convertDateYearFirst(rangeStart)] = {weekAccumScore: 0}
                
                const weekIterator = new Date(rangeStart)
                for(let j = 0; j<7; j++){
                    if(dates.find((d) => d === convertDateYearFirst(weekIterator))){
                        weekly[convertDateYearFirst(rangeStart)].weekAccumScore += dataObject[convertDateYearFirst(weekIterator)].score
                    }
                    weekIterator.setDate(weekIterator.getDate() + 1)
                }
                if(accum && Object.keys(weekly).length > 1)
                    weekly[convertDateYearFirst(rangeStart)].weekAccumScore += weekly[convertDateYearFirst(prevSunday)].weekAccumScore
            }
            rangeStart.setDate(rangeStart.getDate() + 1)
        }
    }
    
    console.log(weekly)
    if(chart)
       chart.destroy()
    
    const ctx = document.getElementById("myChart")
    
    const data = {
        labels: "",
        datasets: [{
            label: "",
            data: ""
        }]
    }
    //building data object for easy chart generation
    if(xaxis){
        const weekNumberList = []
        Object.keys(weekly).map(async key => {
            weekNumberList.push(getWeekNumber(key))
        })

        data.labels =  weekNumberList//.keys() extracts every key name in the object into an array which i will use to label each column
        data.datasets[0].label = accum ? "Cumulative Score" : "Weekly Total Game Score"
        data.datasets[0].data = Object.values(weekly).map(week => week.weekAccumScore.toFixed(2))
    }else{
        data.labels = Object.keys(dataObject) //.keys() extracts every key name in the object into an array which i will use to label each column
        data.datasets[0].label = accum ? "Cumulative Score" : "Game Score "
        data.datasets[0].data = accum ? Object.values(dataObject).map(game => game.accumScore) : Object.values(dataObject).map(game => game.score)
    }    
    console.log(data)

    chart = new Chart(ctx, 
        {
            type: accum ? 'line' : 'bar',
            data: data,
            options: {
                scales: {
                    y: {
                        suggestedMax: accum ? 15.00 : 0
                    }
                }
            }
        },
    )
    
}

function loadSideInfo(object, stands){
    const parentDiv = document.getElementById("gameInfo")

    parentDiv.innerHTML = ""


    for(let i = 0; i<Object.keys(object).length; i++){
        let dates = Object.keys(object)
        
        const container = document.createElement("div")
        container.className = "border-2 border-gray-600 h-[4rem] rounded-md m-1 hover:bg-gray-100 transition duration-400"
        parentDiv.appendChild(container)

        const top = document.createElement("div")
        top.className = "flex justify-around border-b-2 border-gray-500 h-[2rem] text-center font-bold"
        container.appendChild(top)

        const awayContainer = document.createElement("div")
        awayContainer.className = "flex justify-around border-b-2 border-gray-500 h-[2rem] text-center font-bold text-center"
        top.appendChild(awayContainer)

        const awayRank = document.createElement("div")
        awayRank.className = "w-[2rem]"
        awayRank.textContent = "#" + object[dates[i]].home ? object[dates[i]].oppRank : object[dates[i]].myRank
        awayContainer.appendChild(awayRank)

        const awayNamePicContainer = document.createElement("div")
        awayNamePicContainer.className = "flex justify-between items-center w-[4rem]"
        awayContainer.appendChild(awayNamePicContainer)

        const awayLogo = document.createElement("img")
        awayLogo.className = "w-[1.5rem] h-[2rem]"
        awayLogo.src = object[dates[i]].home ? object[dates[i]].oppLogo : object[dates[i]].myLogo
        awayNamePicContainer.appendChild(awayLogo)

        const awayName = document.createElement("span")
        awayName.textContent = object[dates[i]].home ? object[dates[i]].oppName : object[dates[i]].myName
        awayNamePicContainer.appendChild(awayName)

        const at = document.createElement("div")
        at.className = "w-[2rem] h-[2rem] text-center"
        at.textContent = "@"
        top.appendChild(at)

        const homeContainer = document.createElement("div")
        homeContainer.className = "flex justify-around border-b-2 border-gray-500 h-[2rem] text-center font-bold text-center"
        top.appendChild(homeContainer)

        const homeRank = document.createElement("div")
        homeRank.className = "w-[2rem]"
        homeRank.textContent = "#" + object[dates[i]].home ? object[dates[i]].myRank : object[dates[i]].oppRank
        homeContainer.appendChild(homeRank)

        const homeNamePicContainer = document.createElement("div")
        homeNamePicContainer.className = "flex justify-between items-center w-[4rem]"
        homeContainer.appendChild(homeNamePicContainer)

        const homeLogo = document.createElement("img")
        homeLogo.className = "w-[1.5rem] h-[2rem]"
        homeLogo.src = object[dates[i]].home ? object[dates[i]].myLogo : object[dates[i]].oppLogo
        homeNamePicContainer.appendChild(homeLogo)

        const homeName = document.createElement("span")
        homeName.textContent = object[dates[i]].home ? object[dates[i]].myName : object[dates[i]].oppName
        homeNamePicContainer.appendChild(homeName)

        const bottom = document.createElement("div")
        bottom.className = "flex h-[2rem] text-center"
        container.appendChild(bottom)

        const outcome = document.createElement("div")
        outcome.className = "w-[4rem] h-[1.9rem] font-bold text-lg border-r-2 border-gray-500"
        outcome.textContent = object[dates[i]].myScore + " - " + object[dates[i]].oppScore
        bottom.appendChild(outcome)

        const letterOutcome = document.createElement("div")
        letterOutcome.className = "w-[3rem] h-[1.9rem] font-bold text-lg border-r-2 border-gray-500"
        if(object[dates[i]].gameType === "REG"){
            letterOutcome.textContent = object[dates[i]].win ? "W" : "L"
            letterOutcome.style.color = object[dates[i]].win ? "green" : "red"
        }else{
            letterOutcome.textContent = object[dates[i]].win ? "OTW" : "OTL"
            letterOutcome.style.color = object[dates[i]].win ? "green" : "red"
        }
        bottom.appendChild(letterOutcome)

        const dateDiv = document.createElement("div")
        dateDiv.className = "w-[4rem] h-[1.9rem] font-bold text-lg border-r-2 border-gray-500"
        dateDiv.textContent = dates[i].substring(5, 7) + "/" + dates[i].substring(8, 10)
        bottom.appendChild(dateDiv)

        const gameScore = document.createElement("div")
        gameScore.className = "w-[3rem] h-[1.9rem] font-bold text-lg"
        gameScore.textContent = object[dates[i]].score.toFixed(2)
        bottom.appendChild(gameScore)
    }
}

