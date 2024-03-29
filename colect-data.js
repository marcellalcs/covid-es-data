const puppeteer = require('puppeteer')
const fs = require('fs')

let scrape = async () => {
  const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage()

  await page.goto('https://coronavirus.es.gov.br/painel-covid-19-es')

  await page.setViewport({ width: 1366, height: 768 });

  console.log("start getting data")

  const covidPannelUrl = await page.evaluate(() =>
    document.querySelectorAll('.iframe-painel-covid')[0].getAttribute('src')
  )
  console.log(covidPannelUrl)
  await page.goto(covidPannelUrl)
  await page.waitForTimeout(10000)

  await page.evaluate(() => {
    button = document.querySelectorAll('.pivotTableCellNoWrap.cell-interactive.tablixAlignLeft')[0]
    button.click();

  });

  const result = await page.evaluate(() => {
    const createCsv = (data) => data
      .map((row) => `${row
        .map((cell) => `"${cell.replace(",", "")}"`)
        .join(',')}\n`)
      .join('');

    const body = document.querySelectorAll('.bodyCells')[0]

    const generalData = document.querySelectorAll('.value')
    const totalCases = generalData[0].textContent
    const totalDeath = generalData[7].textContent

    const finalData = [
      ['municipio', 'confirmados', 'mortes'],
      ['TOTAL NO ESTADO', `${totalCases}`, `${totalDeath}`],
      ['Importados/Indefinidos', '0', '0'],
    ]

    // Data structure = ['id', 'municipio', 'populacao', 'confirmados', 'obitos', 'letal']
    // Colecting data from dashboard
    return new Promise((resolve, reject) => {
      const scrollTimer = setInterval(() => {
        const dataWrapper = body.firstElementChild.firstElementChild
        const dataWrapperHeight = dataWrapper.offsetHeight
        const scrollHeightToShowMore = dataWrapperHeight + 1
        const visibleColumns = [...dataWrapper.children]
        const data = visibleColumns.map(column => [...column.children].map(cel => cel.textContent))
        const totalRows = data[0].length
        const totalColumns = data.length

        for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
          let newRow = []
          for (let colIndex = 1; colIndex < totalColumns; colIndex++) { //starts on 1, to not colect id
            if(colIndex == 1 || colIndex == 3 || colIndex == 4) { // do not colect populacao and letal
              newRow.push(data[colIndex][rowIndex])
            }
          }
          finalData.push(newRow)
        }

        if (body.scrollTop + scrollHeightToShowMore > body.scrollHeight) {
          clearInterval(scrollTimer);
          const totalDashboardCases = parseInt(finalData[1][1].replace(",", ""))
          const totalDashboardDeaths = parseInt(finalData[1][2].replace(",", ""))

          const mapedCases = finalData.map((x) => x[1]).map((x) => x.replace(",","")).map(x => parseInt(x))
          mapedCases.shift()
          mapedCases.shift()
          mapedCases.shift()
          const mapedDeath = finalData.map((x) => x[2]).map((x) => x.replace(",","")).map(x => parseInt(x))
          mapedDeath.shift()
          mapedDeath.shift()
          mapedDeath.shift()
          
          const sumCases = mapedCases.reduce((x, y) => x + y)
          const sumDeath = mapedDeath.reduce((x, y) => x + y)
        
          finalData[2][1] = `${totalDashboardCases - sumCases}`
          finalData[2][2] = `${totalDashboardDeaths - sumDeath}`

          const csv = createCsv(finalData)
          return resolve(csv)
        }
        else {
          body.scrollTop += scrollHeightToShowMore;
        }
      }, 2000);
    })
  })

  browser.close()
  console.log("recording data...")
  return result
};

scrape().then((value) => {
  var today = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split("/").join("-")

  fs.writeFileSync(`csv/${today}-ES.csv`, value);
  console.log(value)

  var html = `<!DOCTYPE html>
  <html lang="en">
    <head>
      <title>Dados COVID</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: Arial, Helvetica, sans-serif;
        }
      </style>
    </head>
    <body>
      <h1>Dados COVID ES</h1>

      <p>Dados coletados: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
      <a href="${today}-ES.csv" download='dados-${today}'>Download CSV</a>
      
    </body>
  </html>`

  fs.writeFileSync("csv/index.html", html)
})