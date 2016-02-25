/**
* This work is licensed under the 
* Creative Commons Attribution-ShareAlike 3.0 Unported License. 
* To view a copy of this license, visit 
* http://creativecommons.org/licenses/by-sa/3.0/
*
* joseph@lostsource.com
*
**/

"use strict";

var JSHexGrid = (function(){

	function GridSelection(start) {
		var stop = arguments[1];
		var oldSelection; // set onBeforeChange, sent onChange
		var that = this;

		start = (start === undefined) ? -1 : start;
		stop = (stop === undefined) ? -1 : stop;

		this.inProgress = false;

		this.setStart = function(val) {
			_onbeforechange.apply(this,[]);
			start = parseInt(val,10);
			_onchange.apply(this,[]);
		}

		this.setStop = function(val) {
			_onbeforechange.apply(this,[]);		
			stop = parseInt(val,10);
			_onchange.apply(this,[]);
		}

		this.getStart = function() {
			return (start < stop) ? start : stop;
		}

		this.getStop = function() {
			return (stop > start) ? stop : start;
		}

		this.getLength = function() {
			if(!this.exists()) {
				return false;
			}

			return (this.getStop()-this.getStart())+1;
		}

		this.exists = function() {
			return (!((start == -1) || (stop == -1)));
		}

		this.hasAddress = function(adr) {
			if(!this.exists()) {
				return false;
			}

			if((adr >= this.getStart()) && (adr <= this.getStop())) {
				return true;
			}

			return false;
		}

		this.reset = function() {
			_onbeforechange.apply(this,[]);
			start = -1;
			stop = -1;
			_onchange.apply(this,[]);
		}

		// selection id consists of selectionStart:selectionLength
		this.getId = function() {
			return this.getStart()+":"+((this.getStop() - this.getStart())+1);
		}

		this._setInProgress = function(val) {
			// switch start/stop so that start is never bigger then stop
			if(start > stop) {
				var tmpStop = stop;
				stop = start;
				start = tmpStop;
			}

			this.inProgress = val;

		}

		function _onbeforechange() {
			
			oldSelection = new GridSelection(that.getStart(),that.getStop());

			if(typeof(that.onbeforechange) == "function") {
				that.onbeforechange.apply(that,arguments);
			}
		}

		function _onchange() {
			if(typeof(that.onchange) == "function") {
				that.onchange.apply(that,[that,oldSelection]);
			}
		}
	}

	function getDefaultColors() {
		return { selection: '#eeeeee', hover: '#cccccc', background: 'white'}		
	}

	return {
		dataHandler: {
			file: function(file) {
				return new (function(){
					this.getSize = function() {
						return file.size;
					}

					this.getByteArray = function(start,end,callback) { 
						callback = callback || function() {};

						var reader = new FileReader();	
						var blob = file.slice(start,end);

						reader.onload = function(e){
							var rawbuffer = e.target.result;
							var buffer = new Uint8Array(rawbuffer);
							callback(buffer);
						}

	
						reader.readAsArrayBuffer(blob);
					}
				})();
			}
		},

		theme: {
			default: getDefaultColors(),
			dark: {
				foreground: 'white',
				background: '#272822',
				address: '#66d9ef',
				text: '#e6db74',
				hover: '#444444',
				selection: '#4b2d2d'
			},
			light: {
				background: '#e8eaf2',
				foreground: 'black',
				address: '#870d3d',
				text: '#0b6125',
				hover: '#eeeeee',
				selection: '#b9cafa'
			}
		},

		grid: function(gridOpts) {
			var rowTotal = (typeof(gridOpts.rows) === "undefined") ? 16 : parseInt(gridOpts.rows,10);
			var userContainer = gridOpts.container;
			var preselect = gridOpts.selection;
			var dataSrc = gridOpts.dataSrc;
			var gridColors = gridOpts.colors || {};
			var gridCols = (typeof(gridOpts.cols) === "undefined") ? 16 : parseInt(gridOpts.cols,10);
			var gridInterval = (typeof(gridOpts.interval) === "undefined") ? 8 : parseInt(gridOpts.interval,10);
			var gridAligned = (typeof(gridOpts.aligned) === "undefined") ? true : gridOpts.aligned;

			var that = this;
			var curOffset = 0;
			var curBuffer = false;
			// byte or text? 
			// this is used for external info, 
			// eg determining what to automatically copy, text or hex? 
			// (only when using CTRL+C shortcut)
			var lastHoverType = ""; 

			function getSpaces(cnt) {
				var str = "";
				for(var x = 0; x < cnt; x++) {
					str += "."
				}
				return str;
			}

			var selection = preselect || new GridSelection();

			selection.onchange = function() {
				emitEvent("rangechange",arguments);
				if(!selection.exists()) {
					clearSelectionDisplay(); 
				}
				else {
					updateSelectionDisplay();
				}
			}

			function getGridSize() {
				return (rowTotal*gridCols);
			}

			function isRangeInView(start,stop) {
				/*
					Some logic, assuming view starts at Byte 100 and ends at Byte 200
					# 50 - 70	(Stop is < ViewStart) inRange = false
					# 50 - 250	(ViewStart >= Start) && (ViewStop <= Stop) inRange = true
					# 150 - 160	((Start is >=  ViewStart) && (Start <= ViewStop)) inRange = true
					# 180 - 220	((Start is >=  ViewStart) && (Start <= ViewStop)) inRange = true
					# 210 - 250	(Start is > ViewStop) inRange = false
				*/

				var viewStart = curOffset;
				var viewStop = viewStart + (getGridSize()-1); // -1 as viewStart is a byte itself

				if((start > viewStop) || (stop < viewStart)) {
					return false;
				}

				if((start >= viewStart) && (start <= viewStop)) {
					return true;
				}

				if((viewStart >= start) && (viewStop <= stop)) {
					return true;
				}

				return false;
			}

			function clearSelectionDisplay() {
				var byteTd, charTd, byteOffset, len = byteMap.length;

				for(var x = 0; x < len; x++) {
					byteTd = byteMap[x].parentNode;
					charTd = charMap[x].parentNode;
					byteOffset = curOffset + x;

					setByteElemDefault(byteTd);
					setTextElemDefault(charTd);
				}
			}

			function updateSelectionDisplay() {
				
				if(!selection.exists()) {
					return false;
				}

				var start = selection.getStart();
				var stop = selection.getStop();

				// if selection is NOT within current view stop here
				if(!isRangeInView(start,stop)) {
					//return false;
				}

				var byteTd, charTd, byteOffset, len = byteMap.length;

				for(var x = 0; x < len; x++) {
					byteTd = byteMap[x].parentNode;
					charTd = charMap[x].parentNode;

					byteOffset = curOffset + x;

					if((byteOffset >= start) && (byteOffset <= stop)) {
						setByteElemSelected(byteTd);
						setTextElemSelected(charTd);
					}
					else {
						setByteElemDefault(byteTd);
						setTextElemDefault(charTd);
					}
				}
			}

			var addrMap = [];
			var byteMap = [];
			var charMap = [];

			var invisibleChars = getInvisibleAsciiCodes();

			var outer = document.createElement("div");
			outer.onselectstart = function() { return false; };
			outer.style.cursor = 'default';
			outer.onkeydown = function(e) {
				switch(e.keyCode) {
					case 36: // home
						scrollToTop();
					break;
					case 35: // end 
						scrollToBottom();
					break;
					case 38:
						scrollBy(-1);
					break;
					case 40:
						scrollBy(1);
					break;
					case 33: // page up
						scrollByPage(-1);
					break;
					case 34: // page down
						scrollByPage(1);
					break;
				}

				return false;
			}

			var evHandlers = {};

			function emitEvent(evName,evArgs) {
				if(typeof(evHandlers[evName]) != "object") {
					return false;
				}

				var events = evHandlers[evName];
				for(var x = 0; x < events.length; x++) {
					events[x].apply(that,evArgs);
				}
			}

			function wheelHandler(e) {
				var wheelDelta = e.wheelDelta || (e.detail*-1);

				if(wheelDelta > 0) {
					scrollBy(-1);
				}
				else {
					scrollBy(1);	
				}

				return false;
			}

			function byteMouseDownHandler(e) {
				var elem = this;

				var type = elem.getAttribute("_type"); // is this a 'byte' or a 'text' cell ?
				var byteCell = (type == 'byte') ? elem : elem.parentNode.cells[elem.cellIndex-gridCols];

				var adr = getByteCellAddress(byteCell);
				if(adr === false) {
					return false;
				}

				var byteIndex = getByteCellIndex(byteCell);

				if(e.button == 2) { // right click
					emitEvent("bytecontext",[{
						absolute: adr,
						relative: byteIndex
					}]);
				}

				if(e.button === 0) {
					selection._setInProgress(true);
					selection.setStart(adr);
					selection.setStop(adr);
				}
			}

			function byteMouseClickHandler() {
				if(!selectionInProgress()) {
					return false;
				}

				selection.reset();
			}

			function byteMouseUpHandler() {
				if(!selectionInProgress()) {
					return false;
				}

				selection._setInProgress(false);
			}

			function byteMouseOverHandler() {
				var elem = this;
				var type = elem.getAttribute("_type"); // is this a 'byte' or a 'text' cell ?
				lastHoverType = type;
				var byteCell = (type == 'byte') ? elem : elem.parentNode.cells[elem.cellIndex-gridCols];

				var altType = (type == 'byte') ? 'text' : 'byte';
				var altOffset = (type == 'byte') ? gridCols : -gridCols;

				var adr = getByteCellAddress(byteCell);
				var cellIndex = getByteCellIndex(byteCell);

				if(adr === false) {
					return false;
				}

				emitEvent("bytehover",[{
					"absolute": adr,
					"relative": cellIndex
				}]);

				// changes color of current item being hovered
				elem.className = type+' highlight';
				elem.parentNode.cells[elem.cellIndex+altOffset].className = altType+" highlight";

				if(gridColors.hover) {
					elem.style.backgroundColor = gridColors.hover;
					elem.parentNode.cells[elem.cellIndex+altOffset].style.backgroundColor = gridColors.hover;
				}

				if(!selectionInProgress()) {
					return false;
				}

				selection.setStop(adr);
			}

			function setByteElemDefault(elem) {
				if(gridColors.hover) {
					elem.style.backgroundColor = "";
				}

				elem.className = "byte";				
			}

			function setByteElemSelected(elem) {
				if(gridColors.hover) {
					elem.style.backgroundColor = "";
				}

				if(gridColors.selection) {
					elem.style.backgroundColor = gridColors.selection;
				}

				elem.className = "byte selected";				
			}			

			function setTextElemDefault(elem) {
				if(gridColors.hover) {
					elem.style.backgroundColor = "";
				}

				if(gridColors.text) {
					elem.style.color = gridColors.text;
				}

				elem.className = "text";
			}

			function setTextElemSelected(elem) {
				if(gridColors.hover) {
					elem.style.backgroundColor = "";
				}

				if(gridColors.selection) {
					elem.style.backgroundColor = gridColors.selection;
				}


				elem.className = "text selected"				
			}

			function setByteStyleDefault(elem) {
				setByteElemDefault(elem);
				setTextElemDefault(elem.parentNode.cells[elem.cellIndex+gridCols]);
			}

			function setByteStyleSelected(elem) {
				setByteElemSelected(elem);
				setTextElemSelected(elem.parentNode.cells[elem.cellIndex+gridCols]);
			}

			function byteMouseOutHandler() {
				var elem = this;

				var type = elem.getAttribute("_type"); // is this a 'byte' or a 'text' cell ?
				var byteCell = (type == 'byte') ? elem : elem.parentNode.cells[elem.cellIndex-gridCols];
	

				if(!selection.hasAddress(getByteCellAddress(byteCell))) {
					setByteStyleDefault(byteCell);
				}
				else {
					setByteStyleSelected(byteCell);
				}

				emitEvent("byteout");
			}

			outer.addEventListener("mousewheel",wheelHandler,false); // chrome / ie
			outer.addEventListener("DOMMouseScroll",wheelHandler,false); // firefox

			outer.style.position = "relative";

			var x;
			var tbl = document.createElement("table");
			if(gridColors.background) {
				tbl.style.backgroundColor = gridColors.background;
			}

			if(gridColors.foreground) {
				tbl.style.color = gridColors.foreground;
			}
			

			tbl.setAttribute("cellpadding","0");
			tbl.setAttribute("cellspacing","0");


			tbl.style.fontFamily = "monospace";
			tbl.style.fontSize = "14px";
			tbl.style.paddingLeft = "10px";
			tbl.style.paddingRight = "10px";

			for(var r = 0; r < rowTotal; r++) {
				var row = tbl.insertRow(r);
				var adr = row.insertCell(-1);
				adr.className = 'address';

				if(gridColors.address) {
					adr.style.color = gridColors.address;
				}

				var adrValue = document.createTextNode(getSpaces(8));
				addrMap.push(adrValue)
				adr.appendChild(adrValue);
				adr.style.paddingRight = "10px";
				adr.style.paddingTop = "2px";
				adr.style.paddingBottom = "2px";

				// create cells for #gridCols bytes in line
				var tdByte,byteValue;
				for(x = 0; x < gridCols; x++) {
					tdByte = row.insertCell(-1);
					tdByte.addEventListener("click",byteMouseClickHandler,false);
					tdByte.addEventListener("mousedown",byteMouseDownHandler,false);
					tdByte.addEventListener("mouseup",byteMouseUpHandler,false);
					tdByte.addEventListener("mouseover",byteMouseOverHandler,false);
					tdByte.addEventListener("mouseout",byteMouseOutHandler,false);

					tdByte.className = 'byte';
					tdByte.style.textTransform = "uppercase";
					tdByte.style.paddingLeft = "4px";
					tdByte.style.paddingRight = "4px";
					setByteElemDefault(tdByte);

					if(((x % gridInterval) == (gridInterval-1)) || (x==gridCols-1)) {
						tdByte.style.setProperty('border-right',"12px solid "+(gridColors.background || "transparent"),"important");
					}

					tdByte.setAttribute("_type","byte");

					byteValue = document.createTextNode(getSpaces(2));
					byteMap.push(byteValue);
					tdByte.appendChild(byteValue);
				}

				// create cells for plain text char values
				var tdChar,charValue;
				for(x = 0; x < gridCols; x++) {
					tdChar = row.insertCell(-1);

					tdChar.addEventListener("click",byteMouseClickHandler,false);
					tdChar.addEventListener("mousedown",byteMouseDownHandler,false);
					tdChar.addEventListener("mouseup",byteMouseUpHandler,false);
					tdChar.addEventListener("mouseover",byteMouseOverHandler,false);
					tdChar.addEventListener("mouseout",byteMouseOutHandler,false);

					tdChar.className = 'text';
					setTextElemDefault(tdChar);

					tdChar.setAttribute("_type","char");
					charValue = document.createTextNode(getSpaces(1));
					charMap.push(charValue);
					tdChar.appendChild(charValue);
				}		
			}

			var totalLines = Math.ceil(dataSrc.getSize()/gridCols);

			// calculate height of 16 lines so we know height of 1 line
			// table must be temporary appended (visibility hidden)
			tbl.style.visibility = "hidden";
			tbl.style.position = "absolute";
			tbl.style.top = "0px";
			tbl.style.left = "0px";

			userContainer.appendChild(tbl);
			var gridHeight = tbl.offsetHeight;
			var tblWidth = tbl.offsetWidth;

			userContainer.removeChild(tbl);
			tbl.style.visibility = "visible";

			var lineHeight = Math.floor(gridHeight / rowTotal);
			
			var scroller = document.createElement("div");
			scroller.style.position = "absolute";
			scroller.style.top = "0px";
			scroller.style.left = "0px";

			// inner div is not visible but its height is set 
			// to predict height of all data lines
			var innerPxLen = (lineHeight*(totalLines));

			// inner div cant have 'extreme' height, otherwise browsers will
			// trip and no scrollbar will be rendered
			if(innerPxLen > (gridHeight*22)) {
				innerPxLen = (gridHeight*22)+getScrollbarWidth();
			}

			var inner = document.createElement("div");
			inner.style.height = innerPxLen+"px";
			inner.innerHTML = "&nbsp;";
			inner.style.position = "absolute";
			inner.style.top = "0px";
			inner.style.left = "0px";
			inner.style.visibility = "hidden";
			scroller.appendChild(inner);

			var lowestScrollPoint = innerPxLen-(gridHeight);
			var lowestOffset = getLastOffset();
			var lowestLine = lowestOffset / gridCols;
			var linesPerPixel = lowestLine / lowestScrollPoint;

			var scrollPixelsPerLine = lowestOffset/lowestScrollPoint;

			function scrollHandler() {
				var scrollerElem = this;

				var scrollLine = Math.ceil((scrollPixelsPerLine*scrollerElem.scrollTop)/gridCols);
				showFromLine(scrollLine,true);
			}

			scroller.onscroll = scrollHandler;

			var scrollBarWidth = getScrollbarWidth();

			scroller.style.height = gridHeight+scrollBarWidth+"px";
			scroller.style.width = (tblWidth+scrollBarWidth)+"px";
			scroller.style.overflow = "scroll";
			outer.style.overflow = "hidden";
			outer.style.height = gridHeight+"px";
			outer.appendChild(scroller);
			outer.style.width = (tblWidth+scrollBarWidth)+"px";

			outer.appendChild(tbl);

			function showFromLine(line,viascroll) {
				showFrom(line*gridCols,viascroll);
			}


			function getByteStr(val) {
				var str = val.toString(16);
				str = str.length == 1 ? "0"+str : str;
				return str.toLowerCase();
			}

			function getPosStr(pos) {
				var str = pos.toString(16);
				
				while(str.length < 8) {
					str = "0"+str;
				}

				return str.toUpperCase();
			}

			/**
			 * @param {...number} offset
			*/

			function showFrom(offset) {
				var viascroll = arguments[1];
				offset = offset || 0;

				if(offset < 0) {
					offset = 0;
				}

				offset = parseInt(offset,10);

				// to prevent bad grid offsets, we must make sure
				// that offset is a multiple of 16..
				// ie .. 0 16 32 48.. etc.
				// if it isnt we subtract from offset until we find
				// a valid offset

				if (gridAligned) {
					offset = Math.floor(offset / gridCols) * gridCols;
				}



				if((offset+(rowTotal*gridCols)) > dataSrc.getSize()) {
					// offset overrun
					// move to last possible offset
					offset = getLastOffset();
				}
				var reader = new FileReader();	

				var stopAddress = offset+(rowTotal*gridCols);

				// we retrieve 7 extra bytes for possible external use
				// when showing value information (as they may depend 
				// on values out of current view)
				stopAddress += 7;

				dataSrc.getByteArray(offset,stopAddress,function(byteArr){
					curBuffer = byteArr.buffer;

					for(var x = 0; x < byteMap.length; x++) {
						if(byteArr[x] === undefined) {
							byteMap[x].nodeValue = "  ";
							charMap[x].nodeValue = " "
							continue;
						}

						// update address value
						if((x % gridCols) === 0) {
							var lineNum = x / gridCols;
							addrMap[lineNum].nodeValue = getPosStr(x+offset);
						}

						byteMap[x].nodeValue = getByteStr(byteArr[x]);
						charMap[x].nodeValue = (invisibleChars.indexOf(byteArr[x]) == -1) ? 
								String.fromCharCode(byteArr[x]) : ".";
					}

					curOffset = offset;
					updateSelectionDisplay();
					emitEvent("update",[{
						offset: offset,
						length: ((stopAddress-7)-offset) 
					}]);

					if(!viascroll) {
						// no need to update scrollbar , if call came from scroll itself
						// when scrolled via js we prevent onscroll handler
						// TODO there might be a better way to do this
						scroller.onscroll = function(){
							this.onscroll = scrollHandler;
						};
						scroller.scrollTop = Math.floor((curOffset/gridCols)/linesPerPixel);
					}
				});
			}

			// returns last possible offset before overrun 
			function getLastOffset() {
				if(rowTotal > totalLines) {
					return 0;
				}

				return (totalLines-rowTotal)*gridCols;
			}

			/**
			 * Scroll Control
			 **/
			function scrollBy(lineCount) {
				lineCount = parseInt(lineCount,10)

				var newOffset = curOffset + (lineCount*gridCols);
				showFrom(newOffset);
			}

			function scrollByPage(pageCount) {
				var newOffset;
				newOffset = curOffset + (rowTotal*gridCols)*pageCount;
				showFrom(newOffset);
			}

			function scrollToTop() {
				showFrom(0);
			}

			function scrollToBottom() {
				showFrom(getLastOffset());
			}

			/**
			 * Utilities
			 **/

			// return list of characters which are not graphically rendered
			// eg. tab, backspace character etc..
			// these are eventually replaced by periods in final output
			function getInvisibleAsciiCodes() {
				var tester = document.createElement("span");
				document.body.appendChild(tester);
				var emptyWidth = tester.offsetWidth;

				var invisible = [];
				for(var x = 0; x < 256; x++) {
					if(x == 32) {
						// spacebar is NOT an invisible character
						continue;
					}
					var charval = String.fromCharCode(x).replace(/\s+/g, '');
					tester.innerHTML = charval;

					if(tester.offsetWidth == emptyWidth) {
						invisible.push(x);
					}
				}
				tester.parentNode.removeChild(tester);
				return invisible;
			}

			// returns width of scrollbar in pixels (which may vary between browsers)
			// used to accurately calculate width of elements in order to create 'fake' scroller
			function getScrollbarWidth() {
				var outer = document.createElement("div");
				outer.style.visibility = "hidden";
				outer.style.width = "100px";
				document.body.appendChild(outer);

				var widthNoScroll = outer.offsetWidth;
				// force scrollbars
				outer.style.overflow = "scroll";

				// add innerdiv
				var inner = document.createElement("div");
				inner.style.width = "100%";
				outer.appendChild(inner);        

				var widthWithScroll = inner.offsetWidth;

				// remove divs
				outer.parentNode.removeChild(outer);

				return widthNoScroll - widthWithScroll;
			}

			// returns byte index relative to grid.. 0-255
			function getByteCellIndex(td) {
				var rowIndex = td.parentNode.rowIndex;
				var cellIndex = td.cellIndex - 1; // -1 to compensate for address cell
				
				return (rowIndex*gridCols)+cellIndex;
			}

			// returns absolute file address of byte in supplied cell.. 0-Total Bytes
			function getByteCellAddress(td) {
				var cellOffset = getByteCellIndex(td);

				var addrOffset = curOffset+cellOffset;
				if(addrOffset >= dataSrc.getSize()) {
					return false;
				}

				return addrOffset;
			}

			function selectionInProgress() {
				return selection.inProgress;
			}

			return {
				render: function() {
					userContainer.appendChild(outer);
					outer.setAttribute("tabindex","1");
					outer.style.outline = "none";
					outer.focus();
					return outer;
				},
				getDimensions: function() {
					return {
						height: gridHeight,
						width:  (tblWidth+scrollBarWidth),
						row: {
							height: lineHeight,
							count: rowTotal
						}
					}
				},
				getElementsByIndex: function(ndx) {
					if((!byteMap[ndx]) || (!charMap[ndx])) {
						return false;
					}

					return {
						byte: byteMap[ndx].parentNode,
						char: charMap[ndx].parentNode
					};
				},
				getLastHoverType: function() {
					return lastHoverType;
				},
				getOffset: function() {
					return curOffset;
				},
				getSize: function() {
					return (rowTotal*gridCols);
				},
				getBuffer: function() {
					return curBuffer;
				},
				getSelection: function() {
					return selection;
				},
				showFrom: showFrom,
				scrollBy: scrollBy,
				scrollByPage: scrollByPage,
				scrollToTop: scrollToTop,
				scrollToBottom: scrollToBottom,
				on: function(evName,evCallback) {
      				evHandlers[evName] = evHandlers[evName] || [];
      				evHandlers[evName].push(evCallback);
				}
			}
		}
	}
})();