function createCodeMirror2(place, options, source) {
	return new CodeMirror(place, $.extend({}, {
		mode: 'javascript',
		tabSize: 4, indentUnit: 2, readOnly: true,
		value: source,
	}, options));
}
