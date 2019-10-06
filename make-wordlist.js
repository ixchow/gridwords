const fs = require('fs');

let loading = 0;

process.argv.slice(2).forEach(function(arg){
	loading += 1;
	fs.readFile(arg, {encoding:"ascii"}, gotList);
});

function gotList(err, data) {
	if (err) throw err;
	data.split(/\s+/).forEach(function(word){
		if (word.indexOf("'") !== -1) return;
		if (!/^[a-z]*$/.test(word)) return;
		gotWord(word);
	});
	loading -= 1;
	if (loading == 0) {
		writeList();
	}
}

const root = {};

function gotWord(word) {
	let at = root;
	for (let i = 0; i < word.length; ++i) {
		let c = word[i];
		if (!(c in at)) at[c] = { };
		at = at[c];
	}
	at.end = true;
}

function writeList() {
	let list = "";
	let words = 0;
	function writeLevel(level) {
		for (let name in level) {
			if (name === "end") continue;
			list += name;
			writeLevel(level[name]);
		}
		if (level.end) {
			list += "*";
			words += 1;
		} else list += ".";
	}
	writeLevel(root);
	console.log("List length: " + list.length + ", words: " + words);
	fs.writeFileSync("words.tree", list, "utf8");
}
