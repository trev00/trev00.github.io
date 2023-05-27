function loadPDFJS(pageUrl) {
    PDFJS.workerSrc = 'resources/js/pdfjs/pdf.worker.js';
    var currentPage = 1;
    var pages = [];
    var globalPdf = null;
    var container = document.getElementById('pdf-container');
    function renderPage(page) {
       
        var canvas = document.createElement('canvas');
      
        var viewport = page.getViewport(window.screen.width / page.getViewport(1.0).width);

        container.appendChild(canvas);
  
        var context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
 
        var renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        page.render(renderContext).then(function () {
            if (currentPage < globalPdf.numPages) {
                pages[currentPage] = canvas;
                currentPage++;
                globalPdf.getPage(currentPage).then(renderPage);
            } else {
            
            }
        });
    }
    PDFJS.getDocument(pageUrl).then(function (pdf) {
        if(!globalPdf){
            globalPdf = pdf;
        }
        pdf.getPage(currentPage).then(renderPage);
    });
}
loadPDFJS("Trevor Tuck - Design Portfolio");
