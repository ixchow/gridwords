
SCOWL=../scowl-2018.04.16/final

words.tree : make-wordlist.js
	node make-wordlist.js $(SCOWL)/*-words.[123456789]0 $(SCOWL)/*-words.[12345678]5
