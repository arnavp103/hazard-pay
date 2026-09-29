"""Hand-authored native pixel masks for an elevated 2.5D battlefield.
Pillow is an authoring tool only; runtime uses the committed atlases.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageColor
import math, random
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'apps/webapp/public/emberwatch'
OUT.mkdir(parents=True, exist_ok=True)
P={'o':'#233c37','d':'#405948','g':'#6b8560','h':'#afbd7c','i':'#e7deab','c':'#b28245','b':'#755237','r':'#bf6546','y':'#dfb757','w':'#fff0bb','n':'#232e47','v':'#454d77','u':'#7187b5','l':'#b1c8da','e':'#e49e96','s':'#476664'}
def mask(im,x,y,rows):
 for j,row in enumerate(rows):
  for i,c in enumerate(row):
   if c!='.' and 0<=x+i<im.width and 0<=y+j<im.height:im.putpixel((x+i,y+j),ImageColor.getrgb(P[c])+(255,))
def r(d,box,c):d.rectangle(box,fill=P.get(c,c))
def l(d,pts,c,w=1):d.line(pts,fill=P.get(c,c),width=w)
STATES=['idle','run','strike','stagger','death','charge']
def person(kind,state,f,direction):
 im=Image.new('RGBA',(32,32));d=ImageDraw.Draw(im)
 if state=='death' and f>=4:
  mask(im,8,26,['...ooooooo....','.ooddgggddoo..','odgcggccbbbbo.','.oooooobbooo..']);return im
 moving=state in ('run','charge'); swing=[-2,-1,1,2,2,0,-1,-2][f] if moving else 0
 bob=(f%4==1) if moving else 0;x=13;y=7+int(bob)
 if state=='stagger':x-=min(f,3)
 if state=='death':y+=f*2
 # Connected hips, knees and feet; front and rear differ in the body and head.
 l(d,[(x+1,y+12),(x+swing,y+15),(x+swing,y+18)],'o',3)
 l(d,[(x+5,y+12),(x+5-swing,y+16),(x+6-swing,y+18)],'o',3)
 l(d,[(x+1,y+12),(x+swing,y+15)],'g',1)
 l(d,[(x+5,y+12),(x+5-swing,y+16)],'c',1)
 r(d,(x+swing-1,y+18,x+swing+2,y+19),'b');r(d,(x+5-swing,y+18,x+8-swing,y+19),'b')
 back=direction==3; front=direction==1
 mask(im,x-1,y+6,['..oooooo..','.oggggggo.','ogghhgggco','oggggggcco','.oggggccbo','..oddddoo.','..occcco..'])
 if back:mask(im,x-1,y+6,['..oooooo..','.occiccco.','occcicccco','occcicccco','occcicccbo','.obbbbbbo.','..oooooo..'])
 if kind==0:
  mask(im,x-1,y,['..ooooo..','.oghhhgo.','oghhggggo','ogggggggo','oggiiiggo','.ogicgo..','..ooo....'] if not back else ['..ooooo..','.oghhhgo.','oghhggggo','ogggggggo','oggdddgoo','.ogddgo..','..ooo....'])
 elif kind==1:
  mask(im,x-2,y,['..ooooooo..','.oiiccccco.','oicccccccco','ocoooooocco','ocosssoocco','.occbbcco..','..oooooo...'] if not back else ['..ooooooo..','.oiiccccco.','oicccccccco','occccccccco','occccbbbcco','.obbbbbbo..','..oooooo...'])
 elif kind==2:
  mask(im,x,y,['..ooooo.','.orrrrro','orrrrcco','oiowiico','.oiicco.','..obbo..'])
  if back:mask(im,x-2,y+5,['.ooooo..','oiiccbo.','ociccbo.','ociccbo.','ociccbo.','.obbbo..'])
 else:
  mask(im,x,y-1,['..oooo..','.occcco.','occccico','owiwicco','.oiicco.','..obbo..'])
  mask(im,x-2,y+7,['.orrrrrro','oryrrrrro','orrrrrrro','orrrryrro','orryryro.','orryrro..','orrroo...','ooo......'])
 # Authored arms and weapon poses, not a floating weapon overlay.
 wind=state=='strike' and f<3;hit=state=='strike' and 3<=f<=4
 if kind==0:
  wy=y+9-(2 if wind else 0);wx=x+3+(2 if hit else 0)
  l(d,[(x+4,y+8),(wx+2,wy+1)],'c',2)
  mask(im,wx,wy,['..ooooooooo','ooccgssiiio','.ooboooooo.','...oo......'])
  if hit:mask(im,wx+10,wy-1,['..w..','wyww.','.wwyw','..w..'])
 elif kind==1:
  sx=x+5+(2 if hit else 0)
  mask(im,sx,y+7,['.ooooo.','oicccco','ocggcco','ocggcbo','ocggcbo','ocsscbo','.occbo.','..ooo..'])
 elif kind==2:
  mask(im,x+1,y+5,['..ooooooooooo','ooiiggssiccbo','ooggsssscccbo','..oooooooooo.'])
  if hit:r(d,(x-1,y+6,x,y+7),'w')
 else:
  hx=x-2 if wind else x+10;hy=y-2 if wind else y+11
  l(d,[(x+5,y+9),(hx+2,hy+4)],'c',2);l(d,[(hx+2,hy+2),(hx+2,hy+8)],'b',2)
  mask(im,hx-2,hy-1,['.ooooooo.','oiiicccco','ocggccccb','ocggcccbo','.obbbbbo.'])
 if front:
  # Facing down: visible eyes and split boots, muzzle held across chest.
  r(d,(x+1,y+4,x+1,y+4),'w');r(d,(x+4,y+4,x+4,y+4),'w')
 if direction==2:im=im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
 return im

def bug(kind,state,f,direction):
 im=Image.new('RGBA',(32,32));d=ImageDraw.Draw(im);x=9;y=17
 if state=='death' and f>=4:
  mask(im,6,25,['..nnnnnnnnnn....','.nvuuuvvuuuvnn..','nnvvvvvvvvvvvvn.','.nnnnnnnnnnnnn..']);return im
 a=[-2,-1,1,2,1,0,-1,-2][f] if state in ('run','charge') else 0
 if state=='strike':x+=[-1,-2,-3,2,4,2,1,0][f]
 if state=='stagger':x-=min(f,3)
 for k in range(3):
  xx=x+k*4;l(d,[(xx+2,y+2),(xx-3,y+5),(xx-4+a,y+9)],'n',2);l(d,[(xx+3,y+1),(xx+5,y-4),(xx+8-a,y-4)],'v',2)
 mask(im,x-1,y-7,['...nnnnnnnn...','..nvuulluuvn..','.nvuullluuvvn.','nvuuuvvuuvvvvn','nvuuvnuuvvvvnn','.nvvvnuvvvvnn.','..nnnnnnnnnn..'])
 mask(im,x+10,y-2,['..nnnn..','.nuuuvn.','nulelvvn','.nvvvnn.','..nnn...'])
 l(d,[(x+14,y),(x+19,y-3),(x+20,y-1)],'l');l(d,[(x+14,y+1),(x+19,y+4),(x+20,y+2)],'u')
 if kind==5:mask(im,x,y-11,['...nnnnn..','..nveeevn.','.nveweevvn','nvuueuvvvn','.nvvvvvnn.','..nnnnnn..'])
 if direction==3:mask(im,x+1,y-6,['.nuulluuv.','nuulluvvvn','nuvvvvvvvn','.nnnnnnn..'])
 if direction==1:r(d,(x+10,y-1,x+11,y-1),'e')
 if direction==2:im=im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
 return im
atlas=Image.new('RGBA',(256,4608))
for kind in range(6):
 for si,state in enumerate(STATES):
  for direction in range(4):
   for f in range(8):atlas.paste((person if kind<4 else bug)(kind,state,f,direction),(f*32,((kind*6+si)*4+direction)*32))
atlas.save(OUT/'units.png',optimize=True)
queen=Image.new('RGBA',(512,64))
for f in range(8):
 im=Image.new('RGBA',(64,64));d=ImageDraw.Draw(im)
 for k in range(4):
  x=15+k*9;l(d,[(x,30),(x-7,42),(x-10+(f+k)%4,49)],'n',4);l(d,[(x,30),(x-7,42),(x-10+(f+k)%4,49)],'u',1)
 for k in range(4):
  x=10+k*9;y=24-abs(1-k)*2
  d.polygon([(x-4,y),(x+3,y-8),(x+13,y-5),(x+17,y+6),(x+10,y+14),(x-3,y+9)],fill=P['n'])
  d.polygon([(x-2,y),(x+3,y-6),(x+12,y-3),(x+14,y+5),(x+9,y+11),(x-1,y+7)],fill=P['v'])
  d.polygon([(x-2,y),(x+3,y-6),(x+12,y-3),(x+8,y+2),(x,y+4)],fill=P['u'])
  l(d,[(x+2,y-6),(x+4,y-13),(x+7,y-8)],'l',2);r(d,(x+8,y+5,x+9,y+6),'e')
 mask(im,44,28,['..nnnnnnnn.','.nuullluvvn','nuuleeeluuv','nuuleweluvv','.nuueeeuvvn','..nnvvvvnn.','....nnnn...'])
 l(d,[(53,32),(61,26),(63,29)],'l',2);l(d,[(53,36),(61,42),(63,38)],'u',2)
 queen.paste(im,(f*64,0))
queen.save(OUT/'brood.png',optimize=True)
# Entire frame is traversable map. No horizon or side elevation stage.
rng=random.Random(781);im=Image.new('RGB',(640,360),'#899572');d=ImageDraw.Draw(im)
for j in range(1250):
 x=rng.randrange(640);y=rng.randrange(360);w=rng.randrange(3,24)
 d.polygon([(x,y),(x+w,y),(x+w+3,y+3),(x+2,y+4)],fill=rng.choice(['#919b76','#7f8f6b','#98a07b','#83926d']))
# Winding ochre quarry road with branching wheel ruts.
road=[(-30,280),(110,240),(196,229),(266,187),(335,189),(407,141),(514,123),(670,86)]
d.line(road,fill='#778566',width=65);d.line(road,fill='#aeac80',width=51);d.line(road,fill='#b9b389',width=42)
for yoff in [-10,10]:d.line([(x,y+yoff) for x,y in road],fill='#a09e75',width=2)
d.line([(288,190),(278,128),(254,75),(225,-20)],fill='#a6a67c',width=28)
d.line([(353,182),(408,229),(454,293),(502,380)],fill='#a7a87d',width=36)
# Disused curved railway on the western third, flat in the map plane.
for y in range(-20,380,10):
 x=102+round(24*math.sin(y/110));d.polygon([(x-16,y),(x+17,y-5),(x+20,y-2),(x-13,y+3)],fill='#6a775e')
for offset in [-9,10]:
 pts=[(102+round(24*math.sin(y/110))+offset,y) for y in range(-20,380,4)]
 d.line(pts,fill='#526b60',width=3);d.line([(x-1,y) for x,y in pts],fill='#b6b795',width=1)
# Broken tiled foundations read as top faces, then their raised masonry is depth sorted in runtime.
for x,y,w,h in [(274,82,72,36),(335,251,91,39),(475,193,51,24)]:
 d.polygon([(x-3,y+4),(x+w,y-9),(x+w+3,y+h-5),(x,y+h+6)],fill='#62755e')
 d.polygon([(x,y),(x+w,y-13),(x+w,y+h-8),(x,y+h+5)],fill='#a1a786')
 for yy in range(y,y+h,7):
  for xx in range(x,x+w,11):d.line([(xx,yy),(xx+8,yy-1)],fill='#828e72')
# Water drainage pond to north east: top-down rim, no distant skyline.
d.polygon([(455,-10),(645,-10),(652,52),(603,74),(555,62),(528,33),(481,27)],fill='#485f53')
d.polygon([(463,-10),(645,-10),(646,45),(601,65),(557,53),(534,26),(486,19)],fill='#668a7e')
for j in range(90):
 x=rng.randrange(465,640);y=rng.randrange(0,60)
 if im.getpixel((x,y))==(102,138,126):d.line([(x,y),(x+rng.randrange(2,11),y)],fill='#8baf9a')
# Stone flecks and grass tufts distributed over the whole field.
for j in range(1850):
 x=rng.randrange(640);y=rng.randrange(360);c=rng.choice(['#778766','#a6ae81','#bdba8c','#6e8365'])
 d.line([(x,y),(x+2,y)],fill=c)
 if j%4==0:d.line([(x+1,y),(x+1,y-2)],fill=c)
im.save(OUT/'aqueduct.png',optimize=True)
# Individual props used by depth sorting. One cell each: tree, ruin wall, stone, crates, copper tank.
props=Image.new('RGBA',(320,80))
for kind in range(5):
 p=Image.new('RGBA',(64,80));pd=ImageDraw.Draw(p)
 if kind==0:
  l(pd,[(32,65),(31,35),(23,22)],'o',5);l(pd,[(33,62),(33,30)],'b',2)
  for xx,yy,rad in [(19,33,15),(41,34,17),(31,17,17),(29,39,18)]:
   pd.polygon([(xx-rad,yy),(xx-rad+3,yy-8),(xx-4,yy-rad),(xx+8,yy-rad+2),(xx+rad,yy-5),(xx+rad-2,yy+9),(xx+2,yy+13),(xx-rad+4,yy+9)],fill='#2f5547')
   pd.polygon([(xx-rad+3,yy-3),(xx-5,yy-rad+2),(xx+7,yy-rad+4),(xx+rad-3,yy-5),(xx+4,yy+2),(xx-rad+5,yy+2)],fill='#50724e')
   l(pd,[(xx-8,yy-5),(xx-3,yy-8),(xx+3,yy-7)],'#849653',2)
 elif kind==1:
  pd.polygon([(6,54),(48,45),(58,50),(17,60)],fill='#bac29b');pd.polygon([(6,54),(17,60),(17,71),(6,65)],fill='#74846d');pd.polygon([(17,60),(58,50),(58,62),(17,71)],fill='#586f5d')
  for xx in [20,33,47]:l(pd,[(xx,60-(xx-17)//4),(xx,69-(xx-17)//4)],'#425d50')
  l(pd,[(9,57),(16,60),(54,51)],'#d0cf9f')
  r(pd,(21,56,24,58),'g');r(pd,(45,52,49,54),'g')
 elif kind==2:
  pd.polygon([(18,60),(23,52),(38,50),(47,58),(41,67),(23,69)],fill='#576d60');pd.polygon([(18,60),(23,52),(38,50),(44,57),(31,61)],fill='#abb396');l(pd,[(23,53),(35,52)],'#d1cca2')
 elif kind==3:
  for xx,yy in [(13,53),(30,58)]:
   pd.polygon([(xx,yy),(xx+12,yy-4),(xx+21,yy),(xx+8,yy+4)],fill='#c4a469');pd.polygon([(xx,yy),(xx+8,yy+4),(xx+8,yy+15),(xx,yy+11)],fill='#806548');pd.polygon([(xx+8,yy+4),(xx+21,yy),(xx+21,yy+11),(xx+8,yy+15)],fill='#aa8150');l(pd,[(xx+10,yy+4),(xx+10,yy+13)],'#4a5542')
 else:
  pd.ellipse((15,49,49,72),fill='#344f47');r(pd,(16,33,48,60),'b');pd.ellipse((16,26,48,41),fill='#d1a45e');pd.ellipse((18,27,46,38),fill='#a8804b');r(pd,(19,39,23,60),'c');l(pd,[(16,48),(48,48)],'#374e44',3);l(pd,[(18,60),(46,60)],'#374e44',3);r(pd,(30,20,34,30),'b');r(pd,(29,18,35,21),'i')
 props.paste(p,(kind*64,0))
props.save(OUT/'props.png',optimize=True)
print('Authored elevated field, directional native 32px atlases, queen, and sortable props.')
