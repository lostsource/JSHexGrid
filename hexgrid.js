"use strict";

var HexGrid = (function(){

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

		this.setInProgress = function(val) {
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

		grid: function(gridOpts) {
    		var rowTotal = (typeof(gridOpts.rows) === "undefined") ? 16 : parseInt(gridOpts.rows,10);
			var userContainer = gridOpts.container;
			var preselect = gridOpts.selection;
			var dataSrc = gridOpts.dataSrc;

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
				return (rowTotal*16);
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
					byteTd.className = "byte";
					charTd.className = "text";
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
						byteTd.className = "byte selected";
						charTd.className = "text selected";
					}
					else {
						byteTd.className = "byte";
						charTd.className = "text";
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
				if(typeof(evHandlers[evName]) != "function") {
					return false;
				}

				evHandlers[evName].apply(that,evArgs);
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
				var byteCell = (type == 'byte') ? elem : elem.parentNode.cells[elem.cellIndex-16];

				var adr = getByteCellAddress(byteCell);
				if(adr === false) {
					return false;
				}

				var byteIndex = getByteCellIndex(byteCell);

				if(e.button == 2) { // right click
					emitEvent("bytecontext",[{
						address: adr,
						index: byteIndex
					}]);
				}

				if(e.button === 0) {
					selection.setInProgress(true);
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

				selection.setInProgress(false);
			}

			function byteMouseOverHandler() {
				var elem = this;
				var type = elem.getAttribute("_type"); // is this a 'byte' or a 'text' cell ?
				lastHoverType = type;
				var byteCell = (type == 'byte') ? elem : elem.parentNode.cells[elem.cellIndex-16];

				var altType = (type == 'byte') ? 'text' : 'byte';
				var altOffset = (type == 'byte') ? 16 : -16;

				var adr = getByteCellAddress(byteCell);
				var cellIndex = getByteCellIndex(byteCell);

				if(adr === false) {
					return false;
				}

				emitEvent("bytehover",[{
					offset: {
						"address": adr,
						"byte": cellIndex
					}
				}]);

				elem.className = type+' highlight';
				elem.parentNode.cells[elem.cellIndex+altOffset].className = altType+" highlight";

				if(!selectionInProgress()) {
					return false;
				}

				selection.setStop(adr);
			}

			function byteMouseOutHandler() {
				var elem = this;

				var type = elem.getAttribute("_type"); // is this a 'byte' or a 'text' cell ?
				var byteCell = (type == 'byte') ? elem : elem.parentNode.cells[elem.cellIndex-16];

				

				if(!selection.hasAddress(getByteCellAddress(byteCell))) {
					byteCell.className = "byte";
					byteCell.parentNode.cells[byteCell.cellIndex+16].className = "text";
				}
				else {
					byteCell.className = "byte selected";
					byteCell.parentNode.cells[byteCell.cellIndex+16].className = "text selected";
				}

				emitEvent("bytehover",[false]);
			}

			outer.addEventListener("mousewheel",wheelHandler,false); // chrome / ie
			outer.addEventListener("DOMMouseScroll",wheelHandler,false); // firefox

			outer.style.position = "relative";

			var x;
			var tbl = document.createElement("table");
			tbl.className = "hexgrid";
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

				var adrValue = document.createTextNode(getSpaces(8));
				addrMap.push(adrValue)
				adr.appendChild(adrValue);
				adr.style.paddingRight = "10px";
				adr.style.paddingTop = "2px";
				adr.style.paddingBottom = "2px";

				// create cells for 16 bytes in line
				var tdByte,byteValue;
				for(x = 0; x < 16; x++) {
					tdByte = row.insertCell(-1);
					tdByte.addEventListener("click",byteMouseClickHandler,false);
					tdByte.addEventListener("mousedown",byteMouseDownHandler,false);
					tdByte.addEventListener("mouseup",byteMouseUpHandler,false);
					tdByte.addEventListener("mouseover",byteMouseOverHandler,false);
					tdByte.addEventListener("mouseout",byteMouseOutHandler,false);

					tdByte.className = 'byte';
					tdByte.setAttribute("_type","byte");

					byteValue = document.createTextNode(getSpaces(2));
					byteMap.push(byteValue);
					tdByte.appendChild(byteValue);
				}

				// create cells for plain text char values
				var tdChar,charValue;
				for(x = 0; x < 16; x++) {
					tdChar = row.insertCell(-1);

					tdChar.addEventListener("click",byteMouseClickHandler,false);
					tdChar.addEventListener("mousedown",byteMouseDownHandler,false);
					tdChar.addEventListener("mouseup",byteMouseUpHandler,false);
					tdChar.addEventListener("mouseover",byteMouseOverHandler,false);
					tdChar.addEventListener("mouseout",byteMouseOutHandler,false);

					tdChar.className = 'text';
					tdChar.setAttribute("_type","char");
					charValue = document.createTextNode(getSpaces(1));
					charMap.push(charValue);
					tdChar.appendChild(charValue);
				}		
			}

			var totalLines = Math.ceil(dataSrc.getSize()/16);

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
			var lowestLine = lowestOffset / 16;
			var linesPerPixel = lowestLine / lowestScrollPoint;

			var scrollPixelsPerLine = lowestOffset/lowestScrollPoint;

			function scrollHandler() {
				var scrollerElem = this;

				var scrollLine = Math.ceil((scrollPixelsPerLine*scrollerElem.scrollTop)/16);
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
				showFrom(line*16,viascroll);
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

				var hexOffset = offset.toString(16);
				var lastHexNum = hexOffset.substr(hexOffset.length-1,1);
				if(lastHexNum != "0") {
					offset = parseInt(hexOffset.substr(0,hexOffset.length-1)+"0",16);
				}


				if((offset+(rowTotal*16)) > dataSrc.getSize()) {
					// offset overrun
					// move to last possible offset
					offset = getLastOffset();
				}
				var reader = new FileReader();	

				var stopAddress = offset+(rowTotal*16);

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
						if((x % 16) === 0) {
							var lineNum = x / 16;
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
						scroller.scrollTop = Math.floor((curOffset/16)/linesPerPixel);
					}
				});
			}

			// returns last possible offset before overrun 
			function getLastOffset() {
				if(rowTotal > totalLines) {
					return 0;
				}

				return (totalLines-rowTotal)*16;
			}

			/**
			 * Scroll Control
			 **/
			function scrollBy(lineCount) {
				lineCount = parseInt(lineCount,10)

				var newOffset = curOffset + (lineCount*16);
				showFrom(newOffset);
			}

			function scrollByPage(pageCount) {
				var newOffset;
				newOffset = curOffset + (rowTotal*16)*pageCount;
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
				
				return (rowIndex*16)+cellIndex;
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
					return (rowTotal*16);
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
					evHandlers[evName] = evCallback;
				}
			}
		}
	}
})();