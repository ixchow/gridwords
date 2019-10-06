"use strict";

const LEVELS = [
	{	title:"",
		board:[
			" ......... ",
			".gridwords.",
			" ......... ",
		],
		message:'a game for <a href="https://ldjam.com/events/ludum-dare/45">LD48 #45</a><br/><span class="small">(c) 2019 Jim McCann / <a href="http://tchow.com">TCHOW llc</a></span>'
	},
	{	title:"To The Stars",
		board:[
			"nothing",
			"*      ",
		],
		//message:'Click and drag to move tiles.<br/>Make words to cover stars.'
	},
	{	title:"All The Stars",
		board:[
			" *     ",
			"NothinG",
		],
		//message:'Cover all stars with words.<br/><span class="small">(Yes, the wordlist is bigger than the standard scrabble list.)</span>'
	},
	{	title:"Move N First",
		board:[
			"nothiNG",
			"  .    ",
			"  *    ",
		],
		//message:'Tiles will be set down as soon as they make a word.'
	},
	{	title:"Careful Sequencing",
		board:[
			"    *  ",
			"nothing",
			"  . *  ",
			"  *    ",
		]
	},

	{	title:"Embrace and Extend",
		board:[
			"     * ",
			"     . ",
			"notHing",
			"  .    ",
			"ca*    ",
		]
	},
	{	title:"Pivotal Role",
		board:[
			"nothing",
			".      ",
			"*...*  "
		]
	},
	{	title:"Tight Fit",
		board:[
			"  *    ",
			" ..... ",
			"nothing",
			"  .    ",
			"  ..*  "
		]
	},
	{	title:"Crawlers",
		board:[
			" *....  ",
			"    ..  ",
			" .... ..",
			" nothing",
			"   .....",
			"*....   "
		]
	},
	{	title:"",
		board:[
			" ....... ",
			".the.end.",
			" ....... ",
		],
		message:'I hope you enjoyed playing "Gridwords"<br/>Send feedback to <a href="http://tchow.com">Jim McCann / TCHOW llc</a>'
	},
];
