
import Chart from '../src/chart/chart.js';
import ChartComposer from '../src/chart-composer.js';
import parseData from '../src/utils/parse-data.js';


async function main () {

	const data = await fetch('chart_data.json')
		.then((r) => r.json())
		.then((rawData) => parseData(rawData));

	const rootElement = document.querySelector('#root');
	// const charts = [];

	for(let i = 0; i < data.length; i++) {
		const chartContainer = document.createElement('div');
		chartContainer.setAttribute('class', 'chart');
		rootElement.appendChild(chartContainer);

		const chart = new Chart({ rootElement: chartContainer, config: data[i] });

		chart.init();
	}

	// for(let i = 0; i < data.length; i++) {
	// 	const chartContainer = document.createElement('div');
	// 	rootElement.appendChild(chartContainer);
	//
	// 	charts.push(
	// 		new Chart({ rootElement: chartContainer, config: data[i] })
	// 	);
	// }
	//
	// const chartsComposer = new ChartComposer(charts);
	//
	// chartsComposer.start();
	// const chart = new Chart({ rootElement: rootElement, config: data[0] });
	// chart.init();

}


main();
