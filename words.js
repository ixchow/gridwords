"use strict";

const WORDS = {
};

WORDS.load = function WORDS_load(callback) {
	const name = "words.tree";
	var xhr = new XMLHttpRequest();
	xhr.addEventListener('load', function(){
		console.log("Loaded wordlist from '" + name + "'");
		const response = this.response;

		const root = {};
		const stack = [root];
		for (let i = 0; i < response.length; ++i) {
			const c = response[i];
			if (c === '*' || c === '.') {
				if (c === '*') {
					stack[stack.length-1].end = true;
				}
				stack.pop();
				continue;
			}
			console.assert(!(c in stack[stack.length-1]));
			stack.push(stack[stack.length-1][c] = { });
		}
		WORDS.root = root;

		callback();
	});
	xhr.addEventListener('error', function(){
		console.log("Error loading words.");
	});
	xhr.open("GET", name);
	xhr.responseType = "text";
	xhr.send();
};

WORDS.isWord = function WORDS_isWord(word) {
	let iter = new WORDS.Iterator();
	for (let i = 0; i < word.length; ++i) {
		iter.advance(word[i]);
		if (!iter.isPrefix()) return false;
	}
	return iter.isWord();
};

WORDS.isPrefix = function WORDS_isPrefix(word) {
	let iter = new WORDS.Iterator();
	for (let i = 0; i < word.length; ++i) {
		iter.advance(word[i]);
		if (!iter.isPrefix()) return false;
	}
	return iter.isPrefix();
};

WORDS.Iterator = function WORDS_Iterator() {
	this.at = WORDS.root;
	this.word = "";
};
WORDS.Iterator.prototype.advance = function WORDS_Iterator_advace(letter) {
	this.word += letter;
	if (this.at) {
		if (letter in this.at) {
			this.at = this.at[letter];
		} else {
			this.at = null;
		}
	}
};
WORDS.Iterator.prototype.isWord = function WORDS_Iterator_isWord() {
	return (this.at !== null && this.at.end === true);
};
WORDS.Iterator.prototype.isPrefix = function WORDS_Iterator_isPrefix() {
	return (this.at !== null);
};
