var JSZip = require('jszip');
var JSZipUtils = require('jszip-utils');
var FileSaver = require('file-saver');
var PDFDocument = require('pdfkit');
var blobStream = require('blob-stream');

//buttons to switch language
const langButtonEnglish = document.querySelector('#langEN');
const langButtonPolish = document.querySelector('#langPL');

langButtonEnglish.addEventListener('click', function(){changeLanguage('en')});
langButtonPolish.addEventListener('click', function(){changeLanguage('pl')});

//help buttons for each form field
const manifestHelpButton = document.querySelector('#help-manifest');
const regionHelpButton = document.querySelector('#help-region');
const sizeHelpButton = document.querySelector('#help-size');
const rotationHelpButton = document.querySelector('#help-rotation');
const qualityHelpButton = document.querySelector('#help-quality');
const formatHelpButton = document.querySelector('#help-format');
const pagesHelpButton = document.querySelector('#help-pages');

const downloadButton = document.querySelector('#download');
const messages = document.querySelector('#messages');


//help buttons toggle visibility of instructions for each form field
manifestHelpButton.addEventListener('click', ()=>{toggleHelp('#manifest-instructions')});
regionHelpButton.addEventListener('click', ()=>{toggleHelp('#region-instructions')});
sizeHelpButton.addEventListener('click', ()=>{toggleHelp('#size-instructions')});
rotationHelpButton.addEventListener('click', ()=>{toggleHelp('#rotation-instructions')});
qualityHelpButton.addEventListener('click', ()=>{toggleHelp('#quality-instructions')});
formatHelpButton.addEventListener('click', ()=>{toggleHelp('#format-instructions')});
pagesHelpButton.addEventListener('click', ()=>{toggleHelp('#pages-instructions')});

downloadButton.addEventListener('click', download);


fillForm(); //replaces the default form values with GET request query parameters 

function download(){	
	toggleMessage('#message-progress');
	
	let manifestURL = document.querySelector('#manifestURL').value
	let parameters = readForm();
	
	fetch(manifestURL)
		.then((response)=>{
			if(!response.ok){
				throw new Error(`HTTP error: ${response.status}`);
			}
			return response.json()
		})
		.then((data) => {
			if(parameters.downloadFormat === 'zip'){
				generateZip(data, parameters)
			}
			else{
				generatePdf(data, parameters)
			}
		}) 
		.catch((error)=>{
			toggleMessage('#message-error');
			console.error(error);
		});
}

function generateZip(data, parameters){
	let zip = JSZip();
	let canvases = data.sequences[0].canvases;
	
	parameters = fixRange(canvases, parameters);
	
	for(let i=parameters.pageRangeStart; i<=parameters.pageRangeStop; i++){
		let url = generateURL(canvases, parameters, i)
		zip.file(`${parameters.name} ${canvases[i].label}.${parameters.format}`, urlToPromise(url), {binary:true});	
	}		
	
	//Download the generated zip	
	zip.generateAsync({type:"blob"})
	.then(function (blob) {
		saveAs(blob, `${parameters.name}.zip`);
	}).then(function(){
		toggleMessage('#message-success');
	});
}

async function generatePdf(data, parameters){
	let canvases = data.sequences[0].canvases;
	parameters = fixRange(canvases, parameters);
	
	let doc = new PDFDocument({autoFirstPage: false});
	let stream = doc.pipe(blobStream());
	
	for(let i=parameters.pageRangeStart; i<=parameters.pageRangeStop; i++){
		let url = generateURL(canvases, parameters, i);
		await fetch(url)
			.then(response => response.blob())
			.then(blob => {
				//get image data
				var reader = new FileReader();
				reader.onload = function(){
					var img = new Image();
					img.src = url;
					//add image to the pdf
					img.onload = function(){
						doc.addPage({size: [img.width, img.height]});
						doc.image(reader.result, 0, 0);
						if(i==parameters.pageRangeStop){
							doc.end();
						}
					};
				}
				reader.readAsDataURL(blob);
		});
	}
	//save the pdf
	stream.on('finish', function() {
		const blob = stream.toBlob('application/pdf');
		saveAs(blob, `${parameters.name}.pdf`);
		toggleMessage('#message-success');
	});	
}

function urlToPromise(url) {
	return new Promise(function(resolve, reject) {
		JSZipUtils.getBinaryContent(url, function (err, data) {
			if(err) {
				reject(err);
			} else {
				resolve(data);
			}
		});
	});
}

function readForm(){
	let rotationSelector = document.querySelector('#rotation');
	let qualitySelector = document.querySelector('#quality');
	let formatSelector = document.querySelector('#format')

	let split = document.querySelector('#manifestURL').value.split('/');

	const parameters = {
		name: split[split.length-2],
		manifest: document.querySelector('#manifestURL').value,
		region: document.querySelector('#region').value,
		size: document.querySelector('#size').value,
		rotation: rotationSelector.options[rotationSelector.selectedIndex].value,
		quality: qualitySelector.options[qualitySelector.selectedIndex].value,
		format: formatSelector.options[formatSelector.selectedIndex].value,
		pageRangeStart: document.querySelector('#pageRangeStart').value,
		pageRangeStop: document.querySelector('#pageRangeStop').value,
		downloadFormat: document.querySelector('input[name="downloadFormat"]:checked').value
	};
	return parameters;
}

function fixRange(canvases, parameters){ 

	//adjusting for arrays starting with zero
	parameters.pageRangeStart-=1
	parameters.pageRangeStop-=1
	
	//Taking default values for page range if input is out of range or null
	if(parameters.pageRangeStart<0 || parameters.pageRangeStart>canvases.length-1){
	parameters.pageRangeStart=0;
	}
	if(parameters.pageRangeStop<0 || parameters.pageRangeStop>canvases.length-1){
		parameters.pageRangeStop=canvases.length-1;
	}
	return parameters;
}
	
function generateURL(canvases, parameters, i){
	//Returns an url for i-th page of a collection with specified parameters.
	return `${canvases[i].images[0].resource.service['@id']}/${parameters.region}/${parameters.size}/${parameters.rotation}/${parameters.quality}.${parameters.format}`
}

function getDataUri(url, callback) {
	let image = new Image();

	image.crossOrigin = 'anonymous'
	image.onload = function () {
    let canvas = document.createElement('canvas');
		canvas.width = this.naturalWidth;
		canvas.height = this.naturalHeight;

		canvas.getContext('2d').drawImage(this, 0, 0);

		callback(canvas.toDataURL('image/png'));
	};

	image.src = url;
}

function toggleHelp(selector){
	let divs = document.querySelectorAll('div');
	for (let div of divs){
		div.style.display = "none";
	}
	let activeDiv = document.querySelector(selector);
	activeDiv.style.display = "block";
}

function toggleMessage(selector){
	let paragraphs = document.querySelectorAll('p');
	for (let paragraph of paragraphs){
		paragraph.style.display = "none";
	}
	let activeParagraph = document.querySelector(selector);
	activeParagraph.style.display = "block";
}

function fillForm(){
	//
	let manifest = getParameterByName('manifest');
	if(manifest != null){
		document.querySelector('#manifestURL').value = manifest;
	}

	let region = getParameterByName('region');
	if(region != null){
		document.querySelector('#region').value = region;
	}

	let size = getParameterByName('size');
	if(size != null){
		document.querySelector('#size').value = size;
	}

	let start = getParameterByName('start');
	if(start != null){
		document.querySelector('#pageRangeStart').value = start;
	}

	let stop = getParameterByName('stop');
	if(stop != null){
		document.querySelector('#pageRangeStop').value = stop;
	}
	
	let rotation = getParameterByName('rotation');
	if(rotation != null){
		let rotationSelector = document.querySelector('#rotation');
		if(rotation == '90'){
			rotationSelector.selectedIndex = 1;
		}
		else if(rotation == '180'){
			rotationSelector.selectedIndex = 2;
		}
		else if(rotation == '270'){
			rotationSelector.selectedIndex = 3;
		}
	}	
	
	let quality = getParameterByName('quality');
	if(quality != null){
		let qualitySelector = document.querySelector('#quality');
		if(quality == 'color'){
			qualitySelector.selectedIndex = 1;
		}
		else if(quality == 'gray'){
			qualitySelector.selectedIndex = 2;
		}
		else if(quality == 'bitonal'){
			qualitySelector.selectedIndex = 3;
		}
	}	
	
	/*
	let format = getParameterByName('format');
	if(format != null){
		let formatSelector = document.querySelector('#format');
		if(format == 'png'){
			formatSelector.selectedIndex = 1;
		}
		else if(format == 'pdf'){
			formatSelector.selectedIndex = 2;
		}
	}
	*/
	
}

function getParameterByName(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function changeLanguage(language){
	let parameters = readForm();
	window.location.href = `../${language}/?manifest=${parameters.manifest}&region=${parameters.region}&size=${parameters.size}&rotation=${parameters.rotation}&quality=${parameters.quality}&format=${parameters.format}&start=${parameters.pageRangeStart}&stop=${parameters.pageRangeStop}`
}