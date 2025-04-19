let refreshInterval;

function writeMarkerIcon(color,letter,tot1,tot2) {
	document.write('<img src="' + getMarkerPath(color,letter,tot1,tot2) + '" alt="marker">');
}

function getMarkerPath(color,letter,tot1,tot2) {
	var total = parseInt(tot1) + parseInt(tot2);
	if (total == 0 && !isNaN(letter)) {
		color = 'grigio';
	}
	var icon = 'plugins/segreteria-campo/templates/images/it/marker_rosso.png';
	if (!color) {
	} else {
		icon = 'plugins/segreteria-campo/templates/images/it/marker_'+color+'.png';
	}
	if (!letter) {
	} else {
		icon = 'plugins/segreteria-campo/templates/images/en/marker_'+traduciColore(color)+letter.toUpperCase()+'.png';
	}
	return icon;
}

function traduciColore(colore) {
    let coloreInInglese;
    
    switch (colore.toLowerCase()) {
        case 'rosso':
            coloreInInglese = 'red';
            break;
        case 'nero':
            coloreInInglese = 'black';
            break;
        case 'blu':
            coloreInInglese = 'blue';
            break;
        case 'verde':
            coloreInInglese = 'green';
            break;
        case 'grigio':
            coloreInInglese = 'grey';
            break;
        case 'arancione':
            coloreInInglese = 'orange';
            break;
        case 'viola':
            coloreInInglese = 'purple';
            break;
        case 'bianco':
            coloreInInglese = 'white';
            break;
        case 'giallo':
            coloreInInglese = 'yellow';
            break;
        default:
            coloreInInglese = 'red';
    }
    
    return coloreInInglese;
}

// Function to start auto-refreshing the page
function startAutoRefresh() {
  refreshInterval = setInterval(() => {
    location.reload();
  }, 30000); // 30 seconds
}

// Function to stop the auto-refresh
function stopAutoRefresh() {
  clearInterval(refreshInterval);
  // Remove the scroll event listener after first trigger
  window.removeEventListener('scroll', onUserScroll);
}

// Callback for detecting user scroll
function onUserScroll() {
  stopAutoRefresh();
}

// Start auto-refresh when the script loads
startAutoRefresh();

// Listen for the first scroll event
window.addEventListener('scroll', onUserScroll);

