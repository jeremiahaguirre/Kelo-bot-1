import cv2,numpy as np,sys,json
d=sys.argv[1]; cfg=json.load(open(sys.argv[2])); out=sys.argv[3]
W,H=1180,0; rows=[]
def lab(img,text,y=22,scale=0.6):
  cv2.putText(img,text,(12,y),cv2.FONT_HERSHEY_SIMPLEX,scale,(30,30,30),2,cv2.LINE_AA); return img
title=np.full((70,W,3),245,np.uint8)
lab(title,"Kelo-1 paints from live reference photos  -  reference(s) on the left, his painting on the right",34,0.85)
lab(title,"Fixture photos (CC0 / public domain) stand in for live search results; each painting is his medium's brushwork over a simplified underpainting.",60,0.5)
rows.append(title)
for c in cfg:
  n=c['name']; row=np.full((470,W,3),245,np.uint8)
  lab(row,c['label'],26,0.7)
  refs=[cv2.imread(f'{d}/{n}-ref{i}.jpg') for i in range(len(c['refs']))]
  x=12
  for i,r in enumerate(refs):
    r=cv2.resize(r,(256,192),interpolation=cv2.INTER_AREA)
    y=56 if len(refs)==1 else 56+i*214
    if len(refs)==1: y=56+100
    row[y:y+192,x:x+256]=r
    cv2.putText(row,'reference' if len(refs)==1 else ('A: subject' if c.get('how')!='split' and i==0 else 'B: setting/light' if c.get('how')!='split' else f'{"AB"[i]}'),(x,y-6),cv2.FONT_HERSHEY_SIMPLEX,0.45,(90,90,90),1,cv2.LINE_AA)
  p=cv2.imread(f'{d}/{n}.jpg'); p=cv2.resize(p,(int(360*512/384),360),interpolation=cv2.INTER_AREA)
  row[60:60+360,300:300+p.shape[1]]=p
  u=cv2.imread(f'{d}/{n}-under.jpg'); u=cv2.resize(u,(256,192),interpolation=cv2.INTER_AREA)
  ux=300+p.shape[1]+30; row[150:150+192,ux:ux+256]=u
  cv2.putText(row,'his underpainting (value/colour map)',(ux,142),cv2.FONT_HERSHEY_SIMPLEX,0.45,(90,90,90),1,cv2.LINE_AA)
  rows.append(row)
cv2.imwrite(out,np.vstack(rows),[cv2.IMWRITE_JPEG_QUALITY,88])
