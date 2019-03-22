
export default function getMinMaxRange(datasets) {
	const allValues = datasets
		.reduce((values, dataset) => values.concat(dataset.values), []);

	return [0, Math.max.apply(null, allValues)];
}
