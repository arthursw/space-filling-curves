from pathlib import Path
import json
import argparse
from scipy.spatial import KDTree
import svgwrite

parser = argparse.ArgumentParser('JSON to SVG', description='Converts a json file generated with the space-filling-curve webpage to svg.', formatter_class=argparse.ArgumentDefaultsHelpFormatter)

parser.add_argument('-i', '--input', help='Input json', required=True)
# parser.add_argument('-s', '--sorted', action='store_true', help='Path is sorted. Use to skip points sorting.')
parser.add_argument('-m', '--margin', type=float, help='Margin (defined as a percentage of the max side of the drawing bounding box)', default=0.01)

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


svgName = Path(args.input).with_suffix('.svg')
frame_width, frame_height = 1000, 1000

margin = args.margin * max(maxX, maxY)
viewBox = f'{minX - margin:.2} {minY - margin:.2} {maxX + margin:.2} {maxY + margin:.2}'
drawing = svgwrite.Drawing(svgName, width=frame_width, height=frame_height, viewBox=viewBox)

drawing.add(drawing.polyline(data, fill='none', stroke='black', stroke_width=0.5))

drawing.save()