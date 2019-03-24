export default function clickOutside(element, eventName, callback) {

	const outsideClickListener = event => {
		if (!element.contains(event.target) && element !== event.target) {
			callback(event);
		}
	};

	document.addEventListener(eventName, outsideClickListener)
}
