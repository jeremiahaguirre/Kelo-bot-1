import cv2,numpy as np,sys,json,os
CREDIT={'chelsea.png':'"Chelsea the cat" by Stefan van der Walt, CC0 (scikit-image sample data)',
 'coffee.png':'"Coffee cup" by Rachel Michetti, CC0 (scikit-image sample data)',
 'rocket.jpg':'"DSCOVR launch on Falcon 9" by SpaceX, public domain (scikit-image sample data)',
 'venice_sunset.jpg':'"Venice Sunset" (Poly Haven HDRI, crop), CC0',
 'quarry_01.jpg':'"Quarry 01" (Poly Haven HDRI, crop), CC0',
 'moonless_golf.jpg':'"Moonless Golf" (Poly Haven HDRI, crop), CC0'}
d=sys.argv[1]; cfg=json.load(open(sys.argv[2])); out=sys.argv[3]
W,H=1180,0; rows=[]
def lab(img,text,y=22,scale=0.6):
  cv2.putText(img,text,(12,y),cv2.FONT_HERSHEY_SIMPLEX,scale,(30,30,30),2,cv2.LINE_AA); return img
title=np.full((70,W,3),245,np.uint8)
lab(title,"Kelo-1 paints from live reference photos  -  reference(s) on the left, his painting on the right",34,0.85)
lab(title,"Fixture photos (CC0 / public domain) stand in for live search results; each painting is his medium's brushwork over a simplified underpainting.",60,0.5)
rows.append(title)
for c in cfg:
  n=c['name']; row=np.full((540,W,3),245,np.uint8)
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
  meta=json.load(open(f'{d}/{n}.json')) if os.path.exists(f'{d}/{n}.json') else {}
  o=meta.get('o') or {}
  pre=lambda f: 'based on a public-domain image, ' if ('public domain' in CREDIT[f] or 'CC0' in CREDIT[f]) else 'after '
  cred='; '.join(pre(f)+CREDIT[f] for f in c['refs'])
  y0=440
  for k in range(0,len(cred),150):
    cv2.putText(row,('Credit: ' if k==0 else '        ')+cred[k:k+150],(12,y0),cv2.FONT_HERSHEY_SIMPLEX,0.42,(40,40,40),1,cv2.LINE_AA); y0+=18
  sc=f"Similarity to reference: value-map corr {o.get('corr','?')}, palette distance {o.get('palette','?')}  (too close at corr >= 0.90, or >= 0.80 with palette < 0.07)  -> {'STUDY' if o.get('tooClose') else 'his own painting, sellable'}"
  cv2.putText(row,sc,(12,y0+4),cv2.FONT_HERSHEY_SIMPLEX,0.42,(20,90,20) if not o.get('tooClose') else (20,20,160),1,cv2.LINE_AA)
  cv2.putText(row,'Changes: '+', '.join(meta.get('transforms',[])),(12,y0+24),cv2.FONT_HERSHEY_SIMPLEX,0.42,(70,70,70),1,cv2.LINE_AA)
  rows.append(row)
cv2.imwrite(out,np.vstack(rows),[cv2.IMWRITE_JPEG_QUALITY,88])
