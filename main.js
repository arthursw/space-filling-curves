let parameters = {
	nIterations: 7,
	threshold: 0.0245,
	margin: 0.2, // In proportion of the size of the squared image (length of one side)
	showImage: true,
	type: 'hilbert',
	exportSVG: ()=> {
		let visible = preview.visible;
		preview.visible = false;
		let svg = paper.project.exportSVG( { asString: true });

		// create an svg image, create a link to download the image, and click it
		let blob = new Blob([svg], {type: 'image/svg+xml'});
		let url = URL.createObjectURL(blob);
		let link = document.createElement("a");
		document.body.appendChild(link);
		link.download = 'indian.svg';
		link.href = url;
		link.click();
		document.body.removeChild(link);

		preview.visible = visible;
	}
}

let debugStopAfterN = 3;
let debugNStops = 0;

let cornerIndexToName = ['bottomLeft', 'topLeft', 'topRight', 'bottomRight']

var canvas = document.getElementById('canvas');
paper.setup(canvas);

let raster = new paper.Raster('indien3.jpg');
raster.on('load', rasterLoaded);
let preview = null;

let compoundPath = new paper.CompoundPath();
compoundPath.strokeWidth = 0.5;
compoundPath.strokeColor = 'black';

function gosper(rasters, nIterations, i, p1, p2, invert, container) {
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

	if(n - 1 > 0 && n - 1 < rasters.length) {

		let raster = rasters[n - 1]
		let color = raster.getAverageColor(new paper.Path.Circle(raster.bounds.topLeft.add(centerImage), 1.5))
	    let gray = color != null ? color.gray : -1
	    // debugNStops++
		if(1 - gray >= parameters.threshold) {

			for(let j=0 ; j<deltas.length-1 ; j++) {
				let invert = deltas[j].invert
				gosper(rasters, nIterations, i+1, deltas[invert ? j + 1 : j].point, deltas[invert ? j : j+1].point, invert, container)
			}
			return
		}
	}

	let path = new paper.Path()
	path.strokeWidth = 0.5;
	path.strokeColor = 'black';

	compoundPath.addChild(path)

	for(let d of deltas) {
		path.add(d.point)
	}
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


	if(gray >= 0 && gray < 1 - parameters.threshold) {		

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

function draw() {
	compoundPath.removeChildren();

	let rasterClone = raster.clone();

    let ratio = rasterClone.width / rasterClone.height;
    let nIterations = parameters.nIterations;
    let power = parameters.type == 'hilbert' ? nIterations-1 : nIterations+1;
    let maxSize = Math.pow(2, power);
    let maxSizeMargin = maxSize / (1 + parameters.margin);

    if(rasterClone.width > rasterClone.height) {
        rasterClone.height = maxSizeMargin;
        rasterClone.width = rasterClone.height * ratio;
    } else {
        rasterClone.width = maxSizeMargin;
        rasterClone.height = rasterClone.width / ratio;
    }

    let subRaster = rasterClone.getSubRaster(new paper.Rectangle((rasterClone.width-maxSizeMargin)/2, (rasterClone.height-maxSizeMargin)/2, maxSizeMargin, maxSizeMargin));

	let whiteCanvas = document.createElement("canvas");
	whiteCanvas.width = maxSize;
	whiteCanvas.height = maxSize;
	context = whiteCanvas.getContext('2d');
	context.beginPath();
	context.rect(0, 0, maxSize, maxSize);
	context.fillStyle = 'white';
	context.fill();
	let squareRaster = new paper.Raster(whiteCanvas);
	squareRaster.drawImage(subRaster.canvas, new paper.Size(maxSize / 2 - maxSizeMargin / 2));
	squareRaster.remove()

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
	    let p2 = new paper.Point(maxContainerSize * (1 + Math.sqrt(3) / 2) / 2, 3 * maxContainerSize / 4)
		gosper(rasters, nIterations, 1, p1, p2, false, container);
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
	draw();
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

gui.add(parameters, 'type', ['hilbert', 'gosper']).onFinishChange(()=> {
	draw();
});
gui.add(parameters, 'nIterations', 1, 10, 1).onFinishChange(()=> {
	draw();
});
gui.add(parameters, 'threshold', 0, 1).onFinishChange(()=> {
	draw();
});
gui.add(parameters, 'margin', 0, 1).onFinishChange(()=> {
	draw();
});
gui.add(parameters, 'showImage').onFinishChange((value)=> {
	if(preview != null) {
		preview.visible = value;
	}
});

gui.add(parameters, 'exportSVG');
