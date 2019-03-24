export default function clickOutside(element, eventName, callback) {

	const outsideClickListener = event => {
		console.log(element != event.target);
		console.log(!element.contains(event.target));
		if (!element.contains(event.target) && element !== event.target) {
			callback(event);
		}
	};

	document.addEventListener(eventName, outsideClickListener)
}
