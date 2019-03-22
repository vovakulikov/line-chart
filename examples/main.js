
import Chart from '../src/chart/chart.js';
import chartData from '../chart_data.js';
import parseData from '../src/utils/parse-data.js';

const data = chartData[1];

async function main () {
	// const config = {
	// 	timeline: data.columns[0].slice(1),
	// 	datasets: [
	// 		{
	// 			values: data.columns[1].slice(1),
	// 			name: 'y0',
	// 			color: '#3DC23F'
	// 		},
	// 		{
	// 			values: data.columns[2].slice(1),
	// 			name: 'y1',
	// 			color: '#F34C44'
	// 		},
	// 	]
	// };

	const data = await fetch('chart_data.json')
		.then((r) => r.json())
		.then((rawData) => parseData(rawData));

	console.log(data);
	const rootElement = document.querySelector('#root');
	const chart = new Chart({ rootElement, config: data[0] });

	chart.init();
}


main();
