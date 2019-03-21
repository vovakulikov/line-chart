
import ChartMap from '../src/chart-map/chart-map.js';
import chartData from '../chart_data.js';

const rootElement = document.querySelector('.root');
const data = chartData[0];
const config = {
	timeline: data.columns[0].slice(1),
	datasets: [
		{
			values: data.columns[1].slice(1),
			name: 'y0',
			color: '#3DC23F'
		},
		{
			values: data.columns[2].slice(1),
			name: 'y1',
			color: '#F34C44'
		}
	]
};

const chartMap = new ChartMap({ rootElement, config });

chartMap.init();
const loop = (ts) => {
	requestAnimationFrame(loop);

	chartMap.update(ts)
};

requestAnimationFrame(loop);

setTimeout(() => {
	chartMap.turnOffDataset('y1');
}, 4000);


setTimeout(() => {
	chartMap.turnOnDataset('y1');
}, 6000);
