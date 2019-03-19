
// [VK] TODO Add description of this function
export const rafThrottle = function t(f, time) {
	let lastCallTime = performance.now();
	let lastArgs;
	let lastResult;
	let isFirstCall = true;

	return [function () {
		var actualTime = performance.now();
		lastArgs = arguments;

		if ((actualTime - lastCallTime) >= time || isFirstCall) {
			lastResult = f.apply(this, lastArgs);
			lastCallTime = actualTime;
			isFirstCall = false;
		}

		return lastResult;
	}, () => lastCallTime = 0]
};
