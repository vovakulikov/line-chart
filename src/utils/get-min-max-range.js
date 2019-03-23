
export default function getMinMaxRange(datasets) {
	const allValues = datasets
		.reduce((values, dataset) => values.concat(dataset.values), []);

	return [Math.min.apply(null, allValues), Math.max.apply(null, allValues)];
}
