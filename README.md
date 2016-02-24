JSHexGrid
=========

JSHexGrid is a JavaScript object which allows analysis of data in byte and text form. It can be used to analyze file content or any other data sources.

An implementation is currently used in the [HexReader] app for Chrome. 

Usage
=====

JSHexGrid can be initialized by using the `grid` constructor. Parameters are passed using the various properties listed below.

**Creating a grid instance**

    var Grid = new JSHexGrid.grid({
        rows:       // Number of rows to display in grid. 
        (required)  // eg. 16

        cols:       // Number of columns to display in the grid.
                    // Default is 16

        interval:   // Size of the column grouping (i.e. how many columns before an extra space is inserted)
                    // Default is 8

        container:  // Calling Grid.render will append grid to this element
        (required)  // eg. document.getElementById('myGrid')
        
        dataSrc:    // This should contain a DataHandler object described below
        (required)  

        colors:     // set colors of grid based on passed object
                    // built in themes are available
                    // JSHexGrid.theme.default, JSHexGrid.theme.dark, JSHexGrid.theme.light
    });

**DataHandler**

DataHandlers are used to supply the grid with bytes during load time and any time the user scrolls the view.

JSHexGrid comes with a built in File DataHandler. (assuming `myFile` contains a File retrieved via an `<input type='file'/>` dialog)

    dataSrc: JSHexGrid.dataHandler.file(myFile)

If you're not retrieving data from a File, you can implement your own DataHandler. 

Whatever the source of your data, DataHandlers should eventually expose these methods:

`getSize(void)` should return the total amount of bytes available to be read.

`getByteArray(int start, int end, function callback)` should get the data bytes starting at offset *start* and ending at offset *end* and apply them to the passed *callback* function as a Uint8Array parameter.


Grid Methods
============

    getBuffer(void)
    
Returns `ArrayBuffer` of bytes in current view. 

The returned buffer will contain 7 more bytes following the current view (if available). These may be useful for computing 16bit/32bit/64bit values when mouse hovers over last byte in view.
    
    getDimensions(void)
    
Returns dimension information for grid. This could be useful for proper styling of grid surroundings. The object returned contains this structure:

    {
        height:336,    // height of grid in pixels
        width:647,     // width of grid in pixels
        row:{
            height:21, // height of one row in pixels
            count:16   // total number of rows in view
        }
    }

&nbsp;

    getElementsByIndex(int index)
    
Return object with two properties. 


    getOffset(void)
    
Returns current view offset. (absolute address of first byte in view)

    getSelection
    
Returns `GridSelection` object for current selection in view.
    
    getSize(void)
    
Returns total number of bytes which can fit the current view. (16 x number of rows)
    
    render(void)
    
Appends the grid element to the element specified by the constructor parameter 'container'.
    
    scrollBy(int rowOffset)
    
Scrolls view by `rowOffset`. (use negative values for upward scrolling)

    scrollByPage(int pageOffset)
    
Scrolls view by `pageOffset`. (use negative values for upward scrolling) 
    
    scrollToBottom(void)
    
Scrolls view to absolute bottom.

    scrollToTop(void)
    
Scrolls view to absolute top. This is identical to `showFrom(0)`.
    
    showFrom(int offset)
    
Scrolls view so that first byte is at specified `offset`. Value must be 0 or a multiple of 16.

Grid Events
===========

Several events are emitted by a JSHexGrid instance. Listeners can be added by using the `on` method.

**Event: bytecontext**

Emitted when a user right clicks on a byte in the current view.

    Grid.on('bytecontext',function(offset) {
        // offset.absolute, position in buffer
        // offset.relative, position in current view
    });

**Event: byteout**

Emitted when the mouse pointer moves out of a byte cell in the current view. (no parameters in callback)

**Event: bytehover**

Emitted when the mouse pointer moves over a byte cell in the current view.

    Grid.on('bytehover',function(offset) {
        // offset.absolute, position in buffer
        // offset.relative, position in current view
    });

**Event: rangechange**
    
Emitted when a new selection is created or an existant selection is modified.
    
    Grid.on('rangechange',function(curSelect, preSelect) {
        // curSelect, GridSelection object for current selection
        // preSelect, GridSelection object for previous selection
    });
    
**Event: update**    

Emitted when data in the current view changes.

    Grid.on('update',function(viewInfo) {
        // viewInfo.offset, position in buffer of first byte in view
        // viewInfo.length, total bytes in view
    });


[HexReader]:https://chrome.google.com/webstore/detail/hexreader/fejgbfmdlplhjkbpmnedfonifhajinck

