from pathlib import Path
import json
import argparse
from scipy.spatial import KDTree
import svgwrite
import math

parser = argparse.ArgumentParser('JSON to SVG', description='Converts a json file generated with the space-filling-curve webpage to svg.', formatter_class=argparse.ArgumentDefaultsHelpFormatter)

parser.add_argument('-i', '--input', help='Input json', required=True)
parser.add_argument('-pw', '--paperWidth', help='Paper width in mm.', default=500, type=float)
parser.add_argument('-ph', '--paperHeight', help='Paper height in mm.', default=650, type=float)
# parser.add_argument('-pw', '--paperWidth', help='Paper width in mm, compted from height if None (by keeping the drawing aspect ratio). If both height and width are None, width will be set to 500mm and height will be computed accordingly.', default=None, type=float)
# parser.add_argument('-ph', '--paperHeight', help='Paper height in mm, computed from width if None.', default=None, type=float)
# parser.add_argument('-s', '--sorted', action='store_true', help='Path is sorted. Use to skip points sorting.')
parser.add_argument('-m', '--margin', type=float, help='Margin in mm', default=30)
parser.add_argument('-vc', '--verticalCorrection', type=float, help='Vertical correction (to compensate the shilouette offset)', default=-7)
parser.add_argument('-hc', '--heightCorrection', type=float, help='Height correction (to compensate the shilouette scale)', default=0)
parser.add_argument('-df', '--drawFrames', action='store_true', help='Draw the drawing bounding box and the paper rectangle')
parser.add_argument('-sbb', '--skipBoundingBox', action='store_true', help='Do not output the bounding box svg')

args = parser.parse_args()

with open(args.input, 'r') as f:
    data = json.load(f)

# fdata = data if args.sorted else [p for path in data for p in path]
fdata = [p for path in data for p in path]

xs = [p[0] for p in fdata]
ys = [p[1] for p in fdata]

minX = min(xs)
maxX = max(xs)
minY = min(ys)
maxY = max(ys)

def areClose(p1, p2):
    return abs(p2[0] - p1[0]) < 1e-6 and abs(p2[1] - p1[1]) < 1e-6

# if not args.sorted:
width = maxX - minX
height = maxY - minY

# if args.paperWidth is None and args.paperHeight is None:
#     args.paperWidth = 500
# if args.paperWidth is None:
#     args.paperWidth = args.paperHeight * width / height
# if args.paperHeight is None:
#     args.paperHeight = args.paperWidth * height / width

# tree = quads.QuadTree((minX+width/2, minY+height/2), 2*width, 2*height)
ps = [[path[0], path[-1]] for path in data]
ps = [p for s in ps for p in s]

print('Creating tree...')
tree = KDTree(ps)

# for d in data:
#     tree.insert(quads.Point(d[0][0], d[0][1]), data=(d, True))
#     tree.insert(quads.Point(d[-1][0], d[-1][1]), data=(d, False))
print('Creating path...')
finalData = data[0].copy()
n = 1
addedIndices = set()
addedIndices.add(0)
while n<len(data):
    # (d, inverted) = tree.find(finalData[-1]).data
    dd, ii = tree.query(finalData[-1], k=2)
    index = ii[0]//2 if ii[0]//2 not in addedIndices else ii[1]//2
    addedIndices.add(index)
    d = data[index]
    inverted = areClose(finalData[-1], d[-1])
    finalData += d[::-1][1:] if inverted else d[1:]
    n += 1
print('Created path.')
data = finalData

paperRatio = args.paperWidth / args.paperHeight
drawingRatio = width / height

# if paperRatio > drawingRatio: # paper is wider compared to drawing: margin are defined vertically
#     drawingHeightMM = args.paperHeight - 2 * args.margin
#     mmToUnit = height / drawingHeightMM
#     drawingMarginV = args.margin * mmToUnit
#     drawingWidthMM = drawingHeightMM * width / height
#     drawingMarginHMM = (args.paperWidth - drawingWidthMM) / 2
#     drawingMarginH = drawingMarginHMM * mmToUnit
# else: # paper is taller compared to drawing: margin are defined horizontally
#     drawingWidthMM = args.paperWidth - 2 * args.margin
#     mmToUnit = width / drawingWidthMM
#     drawingMarginH = args.margin * mmToUnit
#     drawingHeightMM = drawingWidthMM * height / width
#     drawingMarginVMM = (args.paperHeight - drawingHeightMM) / 2
#     drawingMarginV = drawingMarginVMM * mmToUnit

if paperRatio > drawingRatio: # paper is wider compared to drawing: margin are defined vertically
    mmToUnit = height / (args.paperHeight - 2 * args.margin)
    marginV = args.margin * mmToUnit
    totalWidth = args.paperWidth * mmToUnit
    marginH = (totalWidth - height) / 2
else: # paper is taller compared to drawing: margin are defined horizontally
    mmToUnit = width / (args.paperWidth - 2 * args.margin)
    marginH = args.margin * mmToUnit
    totalHeight = args.paperHeight * mmToUnit
    marginV = (totalHeight - height) / 2

verticalCorrection = args.verticalCorrection * mmToUnit
heightCorrection = args.heightCorrection * mmToUnit
heightMM = height / mmToUnit
hc = ((args.paperHeight * (heightMM + args.heightCorrection) / heightMM) - args.paperHeight) * mmToUnit

input = Path(args.input)
svgName = input.with_suffix('.svg')

viewBox = dict(x=minX - marginH, y=minY - marginV - verticalCorrection, width=maxX + 2 * marginH, height=maxY + 2 * marginV + hc)

viewBoxString = f'{viewBox["x"]:.5} {viewBox["y"]:.5} {viewBox["width"]:.5} {viewBox["height"]:.5}'
drawing = svgwrite.Drawing(svgName, size=(f'{args.paperWidth}mm', f'{args.paperHeight}mm'), viewBox=viewBoxString)

if args.drawFrames:
    drawing.add(drawing.rect(insert=(viewBox["x"], viewBox["y"]), size=(viewBox["width"], viewBox["height"]), fill='none', stroke='red', stroke_width=1))
    drawing.add(drawing.rect(insert=(minX, minY-verticalCorrection), size=(width, height * (viewBox["height"] + hc) / viewBox["height"] ), fill='none', stroke='green', stroke_width=1))
    drawing.add(drawing.rect(insert=(minX, minY), size=(width, height), fill='none', stroke='blue', stroke_width=1))

nPointsMax = 32678
nChunk = math.ceil(len(data) / nPointsMax)

for i in range(nChunk):
    beginPointIndex = i*nPointsMax
    endPointIndex = min(len(data), (i+1)*nPointsMax+1)
    drawing.add(drawing.polyline(data[beginPointIndex:endPointIndex], fill='none', stroke='black', stroke_width=0.5))

drawing.save()

if not args.skipBoundingBox:

    rectangle = svgwrite.Drawing(input.parent / f'{input.stem}_bounding_box.svg', size=(f'{args.paperWidth}mm', f'{args.paperHeight}mm'), viewBox=viewBoxString)
    rectangle.add(rectangle.rect(insert=(minX, minY), size=(width, height), fill='none', stroke='blue', stroke_width=1))
    rectangle.save()