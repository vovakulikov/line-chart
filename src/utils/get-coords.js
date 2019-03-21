
export default function getCoords(elem) {
	const  box = elem.getBoundingClientRect();

	return {
		top: box.top + pageYOffset,
		left: box.left + pageXOffset,
		right: box.right - pageXOffset,
		width: box.width,
		height: box.height,
	};
}
