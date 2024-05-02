let parameters = {
	nIterations: 8,
	globalThreshold: 0.03,
	// margin: 0.0, // In proportion of the size of the squared image (length of one side)
	scale: 1.0,
	posX: 0.0,
	posY: 0.0,
	showImage: true,
	color: false,
	sortPath: false,
	type: 'hilbert',
	exportJSON: ()=> {
		let visible = preview.visible;
		preview.visible = false;
		let path = []
		if(parameters.sortPath) {
			let cs = compoundPath.children.slice()
			let firstChild = cs.shift()
			let segments = firstChild.segments
			path.push([segments[0].point.x, segments[0].point.y])
			while(cs.length>0) {
				for(let i=1 ; i<segments.length ; i++) {
					path.push([segments[i].point.x, segments[i].point.y])
				}
				for(let i=0 ; i<cs.length ; i++) {
					let child = cs[i]
					if(child.firstSegment.point.isClose(path[path.length-1], 1e-6)) {
						segments = child.segments
						cs.splice(i, 1)
						break
					}
					if(child.lastSegment.point.isClose(path[path.length-1], 1e-6)) {
						segments = child.segments.toReversed()
						cs.splice(i, 1)
						break
					}
				}
			}
		} else {

			for(let child of compoundPath.children) {
				let p = []
				for(let segment of child.segments) {
					p.push([segment.point.x, segment.point.y])
				}
				path.push(p)
			}
		}

		// let n=1
		// for(let p of path) {
		// 	var text = new paper.PointText({
		// 		point: p,
		// 		content: ''+n,
		// 		fillColor: 'black',
		// 		fontFamily: 'Courier New',
		// 		fontSize: 8
		// 	});
		// 	n++
		// }

		let blob = new Blob([JSON.stringify(path)], {type: "application/json"})
		let url  = URL.createObjectURL(blob)
		
		// let svg = paper.project.exportJSON( { asString: true });
		// // create an svg image, create a link to download the image, and click it
		// let blob = new Blob([svg], {type: 'image/svg+xml'});
		// let url = URL.createObjectURL(blob);
		let link = document.createElement("a");
		document.body.appendChild(link);
		link.download = 'indian.json';
		link.href = url;
		link.click();
		document.body.removeChild(link);

		preview.visible = visible;
	}
}
let nThresholds = 10

for(let n=0 ; n<nThresholds ; n++) {
	parameters['threshold'+n] = parameters.globalThreshold
}

const rgb_scale = 1;
const cmyk_scale = 1;

function rgb_to_cmyk(r, g, b) {
	// rgb [0,255] -> cmy [0,1]
	let c = 1 - r / rgb_scale;
	let m = 1 - g / rgb_scale;
	let y = 1 - b / rgb_scale;

	// extract out k [0,1]
	let min_cmy = Math.min(Math.min(c, m), y);
	c = (c - min_cmy);
	m = (m - min_cmy);
	y = (y - min_cmy);
	let k = min_cmy;

	// rescale to the range [0,cmyk_scale]
	return {cyan:c * cmyk_scale, magenta: m * cmyk_scale, yellow: y * cmyk_scale, black: k * cmyk_scale};
}

function cmyk_to_rgb(c, m, y, k) {
	let r = rgb_scale * (1.0 - (c + k) / cmyk_scale);
	let g = rgb_scale * (1.0 - (m + k) / cmyk_scale);
	let b = rgb_scale * (1.0 - (y + k) / cmyk_scale);
	return [r, g, b];
}
	
let cornerIndexToName = ['bottomLeft', 'topLeft', 'topRight', 'bottomRight']

var canvas = document.getElementById('canvas');
paper.setup(canvas);

let raster = new paper.Raster('indien3.jpg');
raster.on('load', rasterLoaded);
let preview = null;
let generatingText = null;

// let compoundPath = new paper.CompoundPath();
let compoundPath = new paper.Layer();
let topLayer = new paper.Layer();
// compoundPath.strokeWidth = 0.5;
// compoundPath.strokeColor = 'black';

function gosper(rasters, nIterations, i, p1, p2, invert, container, channel='gray') {
	n = nIterations - i

	let p1p2 = p2.subtract(p1)
	let p1p2Length = p1p2.length
	let p1p2Noramlized = p1p2.normalize()

	let delta = p1p2Noramlized.rotate(-30).multiply(p1p2Length / Math.sqrt(3))
	let center = p1.add(delta)

	let imageSize = rasters[n - 1].width
	let centerImage = center.multiply(imageSize / container.width).floor()

	// console.log('containerSize: ', containerSize)
	// console.log('imageSize: ', imageSize, rasters[n-1].height)
	// console.log('p1: ', p1)
	// console.log('p2: ', p2)
	// console.log('center: ', center)
	// console.log('centerImage: ', centerImage)

    let direction = new paper.Point(2.5, Math.sqrt(3) / 2)
    let step = p1p2Length / direction.length
    let angle = direction.angle
    let vStep = p1p2Noramlized.rotate(angle).multiply(step)

    let deltas = []
    deltas.push({ point: p1, invert: false })
    deltas.push({ point: deltas[deltas.length-1].point.add(vStep), invert: true })
    deltas.push({ point: deltas[deltas.length-1].point.add(vStep.rotate(-60)), invert: true })
    deltas.push({ point: deltas[deltas.length-1].point.subtract(vStep), invert: false })
    deltas.push({ point: deltas[deltas.length-1].point.add(vStep.rotate(-120)), invert: false })
    deltas.push({ point: deltas[deltas.length-1].point.add(vStep), invert: false })
    deltas.push({ point: deltas[deltas.length-1].point.add(vStep), invert: true })
    deltas.push({ point: deltas[deltas.length-1].point.add(vStep.rotate(60)), invert: null })
	// deltas = invert ? deltas.toReversed() : deltas
	if(n - 1 > 0 && n - 1 < rasters.length) {

		let raster = rasters[n - 1]
		let color = raster.getAverageColor(new paper.Path.Circle(raster.bounds.topLeft.add(centerImage), 1.5))
	    // let gray = color != null ? color.gray : -1
		let gray = color != null ? rgb_to_cmyk(color.red, color.green, color.blue)[channel] : -1

		// if(Math.random()<0.01) {
		// 	console.log(channel, gray)
		// }

		// if(1 - gray >= parameters.threshold) {
		
		// if((nIterations-n) < 4.0 * parameters.threshold * (1-gray) * nIterations) {
		// if( gray < parameters.threshold * n / nIterations) {
		// if( 1 - gray < parameters.threshold * n / nIterations ) {
		if( 1 - gray < parameters['threshold'+n] ) {
		// if( 1-gray < parameters.threshold ) {

			for(let j=0 ; j<deltas.length-1 ; j++) {
				let invert = deltas[j].invert
				gosper(rasters, nIterations, i+1, deltas[invert ? j + 1 : j].point, deltas[invert ? j : j+1].point, invert, container, channel)
			}
			return
		}
	}

	let path = new paper.Path()
	path.strokeWidth = 1;//0.5;
	path.strokeColor = channel; //'black';
	path.blendMode = 'multiply'

	compoundPath.addChild(path)

	for(let d of deltas) {
		path.add(d.point)
	}

	// let circle = new paper.Path.Circle(deltas[deltas.length-1].point, n*3)
	// circle.strokeWidth = 0.8
	// circle.strokeColor = 'black'
	// circle.fillColor = null
	// compoundPath.addChild(circle)
}

function hilbert(rasters, nIterations, i, x, y, px, py, quadrant, childNumber, rotation, oppositeDirection, inversion, margin, size) {
	n = nIterations - i;

	x = quadrant == 0 || quadrant == 1 ? 2 * x : 2 * x + 1;
	y = quadrant == 1 || quadrant == 2 ? 2 * y : 2 * y + 1;
	px = quadrant == 0 || quadrant == 1 ? px : px + size;
	py = quadrant == 1 || quadrant == 2 ? py : py + size;

	rotation += childNumber == 0 ? (inversion ? -1 : 1) : childNumber == 1 || childNumber == 2 ? 0 : (inversion ? 1 : -1);
	oppositeDirection += childNumber == 1 || childNumber == 2 ? 0 : 1;
	inversion = childNumber == 1 || childNumber == 2 ? inversion : !inversion;

    let gray = n - 1 > 0 && n - 1 < rasters.length ? rasters[n - 1].getPixel(x, y).gray : -1;

    let quadrants = []
    let addInOppositeDirection = oppositeDirection % 2 == 1;

    // If oppositeDirection : add quadrants in opposite direction
    for(let j = (addInOppositeDirection ? 3 : 0) ; (addInOppositeDirection ? j>=0 : j<4) ; (addInOppositeDirection ? j-- : j++)) {
    	let rj = rotation + j >= 0 ? rotation + j : 4 + ((rotation + j) % 4);
    	let corner = rj % 4;
    	quadrants.push(corner);
    }


	if(gray >= 0 && gray < 1 - parameters['threshold'+n]) {		

		for(let j=0 ; j<4 ; j++) {
			let q = quadrants[j];
			hilbert(rasters, nIterations, i+1, x, y, px, py, q, j, rotation, oppositeDirection, inversion, margin, size / 2);
		}
	} else {
		let r = new paper.Rectangle(px + margin, py + margin, size - 2 * margin, size - 2 * margin);

		let path = new paper.Path()
		path.strokeWidth = 0.5
		path.strokeColor = 'black'

		if(compoundPath.children.length > 0) {
			path.add(compoundPath.children[compoundPath.children.length-1].lastSegment.point)
		}

		compoundPath.addChild(path)

		for(let j=0 ; j<4 ; j++) {
			path.add(r[cornerIndexToName[quadrants[j]]])
		}
	}
}

function displayGeneratingAndDraw() {
	if(generatingText == null) {
		generatingText = new paper.Group()
		let text = new paper.PointText({
			point: paper.view.center,
			content: 'Generating curve...',
			fillColor: 'black',
			fontFamily: 'Courier New',
			fontSize: 25,
			justification: 'center'
		})
		generatingText.addChild(text)
		let textBackground = new paper.Path.Rectangle(text.bounds)
		textBackground.fillColor = 'white'
		generatingText.addChild(textBackground)
		textBackground.sendToBack()
	}
	
	generatingText.bringToFront()
	generatingText.visible = true
	setTimeout(()=> {
		draw()
	}, 250)
}

function createWhiteRaster(width, height) {
	let whiteCanvas = document.createElement("canvas");
	whiteCanvas.width = width;
	whiteCanvas.height = height;
	context = whiteCanvas.getContext('2d');
	context.beginPath();
	context.rect(0, 0, width, height);
	context.fillStyle = 'white';
	context.fill();

	return new paper.Raster(whiteCanvas)
}

function putRasterInRaster(sourceRaster, destinationRaster, sourceRasterTopLeftInDestination) {
	let destinationTopLeft = destinationRaster.bounds.topLeft
	destinationRaster.bounds.topLeft = new paper.Point(0, 0)
	sourceRaster.bounds.topLeft = destinationRaster.bounds.topLeft.add(sourceRasterTopLeftInDestination)
	let intersection = destinationRaster.bounds.intersect(sourceRaster.bounds)
	subRaster = sourceRaster.getSubRaster(new paper.Rectangle(intersection.left-sourceRaster.bounds.left, intersection.top-sourceRaster.bounds.top, intersection.width, intersection.height))
	destinationRaster.drawImage(subRaster.canvas, [intersection.left-destinationRaster.bounds.left, intersection.top-destinationRaster.bounds.top])
	destinationRaster.bounds.topLeft = destinationTopLeft
}

function draw() {
	if(generatingText != null) {
		generatingText.visible = false
	}

	compoundPath.removeChildren();

	let scaledRaster = raster.clone();
	scaledRaster.size = scaledRaster.size.multiply(parameters.scale)
	let bigSize = 400;
	let squareRaster = createWhiteRaster(bigSize, bigSize)
	putRasterInRaster(scaledRaster, squareRaster, squareRaster.size.subtract(scaledRaster.size).divide(2).add(parameters.posX*squareRaster.width/2, parameters.posY*squareRaster.height/2))

	scaledRaster.remove()
	squareRaster.remove()
	// scaledRaster.selected = true
	// squareRaster.selected = true

    // let ratio = rasterClone.width / rasterClone.height;
    let nIterations = parameters.nIterations;
    let power = parameters.type == 'hilbert' ? nIterations-1 : nIterations+1;
    // let maxSize = Math.pow(2, power);
    // let maxSizeMargin = maxSize / (1 + parameters.margin);

    // if(rasterClone.width > rasterClone.height) {
    //     rasterClone.height = maxSizeMargin;
    //     rasterClone.width = rasterClone.height * ratio;
    // } else {
    //     rasterClone.width = maxSizeMargin;
    //     rasterClone.height = rasterClone.width / ratio;
    // }

    // let subRaster = rasterClone.getSubRaster(new paper.Rectangle((rasterClone.width-maxSizeMargin)/2, (rasterClone.height-maxSizeMargin)/2, maxSizeMargin, maxSizeMargin));
	// let squareRaster = bigRaster.getSubRaster(new paper.Rectangle((bigRaster.width-maxSizeMargin)/2, (bigRaster.height-maxSizeMargin)/2, maxSizeMargin, maxSizeMargin));

	// let whiteCanvas = document.createElement("canvas");
	// whiteCanvas.width = maxSize;
	// whiteCanvas.height = maxSize;
	// context = whiteCanvas.getContext('2d');
	// context.beginPath();
	// context.rect(0, 0, maxSize, maxSize);
	// context.fillStyle = 'white';
	// context.fill();
	// let squareRaster = new paper.Raster(whiteCanvas);
	// squareRaster.drawImage(subRaster.canvas, new paper.Size(maxSize / 2 - maxSizeMargin / 2));
	// squareRaster.remove()
	// bigRaster.remove()

    let r = squareRaster;
    let rasters = [r];

    for(var i=0 ; i<nIterations-1 ; i++) {
        r = r.clone();
        r.size = r.size.divide(2);
        rasters.push(r);
        r.visible = false;
    }

    squareRaster.bounds.topLeft = paper.view.bounds.topLeft;

    let maxContainerSize = paper.view.bounds.width < paper.view.bounds.height ? paper.view.bounds.width : paper.view.bounds.height
    let container = new paper.Rectangle(paper.view.center.subtract(maxContainerSize/2), new paper.Size(maxContainerSize))

    if(parameters.type == 'hilbert') {
    	let margin = (container.width / Math.pow(2, power)) / 4;
    	hilbert(rasters, nIterations, 0, 0, 0, 0, 0, 1, 1, 0, 0, false, margin, maxContainerSize);
    } else {
    	let p1 = new paper.Point(maxContainerSize * (1 - Math.sqrt(3) / 2) / 2, 3 * maxContainerSize / 4)
    	let p2 = new paper.Point(maxContainerSize / 2, maxContainerSize)
	    let p3 = new paper.Point(maxContainerSize * (1 + Math.sqrt(3) / 2) / 2, 3 * maxContainerSize / 4)
	    let p4 = new paper.Point(maxContainerSize * (1 + Math.sqrt(3) / 2) / 2, 1 * maxContainerSize / 4)
		let p5 = new paper.Point(maxContainerSize / 2, 0)
		let p6 = new paper.Point(maxContainerSize * (1 - Math.sqrt(3) / 2) / 2, 1 * maxContainerSize / 4)
		// let p3 = new paper.Point(p1.x, p2.y)
		// let p4 = new paper.Point(p2.x, p1.y)
		// gosper(rasters, nIterations, 1, p1, p2, false, container);
		if(parameters.color) {
			gosper(rasters, nIterations, 1, p1, p3, false, container, 'cyan');
			gosper(rasters, nIterations, 1, p3, p5, false, container, 'magenta');
			gosper(rasters, nIterations, 1, p2, p4, false, container, 'yellow');
		}
		gosper(rasters, nIterations, 1, p4, p6, false, container, 'black');
    }

   	console.log(compoundPath.length)
}

function rasterLoaded() {
	if(preview != null) {
		preview.remove();
	}
	preview = raster.clone();
	let maxContainerSize = paper.view.bounds.width < paper.view.bounds.height ? paper.view.bounds.width : paper.view.bounds.height;

    let ratio = preview.width / preview.height;
    let size = maxContainerSize / 8;
    if(preview.width > preview.height) {
        preview.height = size;
        preview.width = preview.height * ratio;
    } else {
        preview.width = size;
        preview.height = preview.width / ratio;
    }

	preview.position = paper.view.bounds.topLeft.add(preview.bounds.size.multiply(0.5));
	raster.remove();
	displayGeneratingAndDraw();
}

function onDocumentDrag(event) {
	event.preventDefault();
}

function onDocumentDrop(event) {
	event.preventDefault();

	var file = event.dataTransfer.files[0];
	var reader = new FileReader();

	reader.onload = function (event) {
		var image = document.createElement('img');
		image.onload = function () {
			raster = new paper.Raster(image);
			rasterLoaded()
		};
		image.src = event.target.result;
	};
	reader.readAsDataURL(file);
}

document.addEventListener('drop', onDocumentDrop, false);
document.addEventListener('dragover', onDocumentDrag, false);
document.addEventListener('dragleave', onDocumentDrag, false);


var gui = new dat.GUI();

gui.add(parameters, 'type', ['hilbert', 'gosper']).onFinishChange((value)=> {
	if(value == 'hilbert') {
		parameters.nIterations = 9
		globalThresholdController.setValue(0.03)
		parameters.margin = 0
	} else if(value == 'gosper') {
		parameters.nIterations = 8
		globalThresholdController.setValue(0.02455)
		parameters.margin = 0.2
	}
	gui.updateDisplay()
	
	displayGeneratingAndDraw();
});
gui.add(parameters, 'color').onFinishChange(()=> {
	displayGeneratingAndDraw();
});

gui.add(parameters, 'nIterations', 1, 10, 1).onFinishChange(()=> {
	displayGeneratingAndDraw();
});

let thresholdControllers = []
let globalThresholdController = gui.add(parameters, 'globalThreshold', 0, 1).onFinishChange((value)=> {
	for(let n=0 ; n<nThresholds ; n++) {
		parameters['threshold'+n] = value
		thresholdControllers[n].setValue(value)
	}
	displayGeneratingAndDraw();
});
for(let n=0 ; n<nThresholds ; n++) {
	thresholdControllers.push(gui.add(parameters, 'threshold'+n, 0, 1).onFinishChange(()=> {
		displayGeneratingAndDraw();
	}))
}
gui.add(parameters, 'scale', 0, 3, 0.01).onFinishChange(()=> {
	displayGeneratingAndDraw();
});
gui.add(parameters, 'posX', -1, 1, 0.01).onFinishChange(()=> {
	displayGeneratingAndDraw();
});
gui.add(parameters, 'posY', -1, 1, 0.01).onFinishChange(()=> {
	displayGeneratingAndDraw();
});
gui.add(parameters, 'showImage').onFinishChange((value)=> {
	if(preview != null) {
		preview.visible = value;
	}
});
gui.add(parameters, 'sortPath');
gui.add(parameters, 'exportJSON');
