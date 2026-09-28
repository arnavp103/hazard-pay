"""Emberwatch native-raster source. Hand-authored masks and discrete key poses.
Recovered from the reviewed authoring source after the execution workspace reset.
"""
from PIL import Image, ImageDraw, ImageFont, ImageColor
from pathlib import Path
import math, random
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'apps/webapp/public/emberwatch';OUT.mkdir(parents=True,exist_ok=True)
P={'o':'#182f39','s':'#34545a','t':'#47766c','g':'#63917a','h':'#abc48e','i':'#e7dfb0','y':'#d9a94e','c':'#a26438','b':'#704530','r':'#bd6248','w':'#ffedc3','n':'#222d4a','v':'#454c83','u':'#687bba','l':'#9fb6d7','e':'#db878c','k':'#111f2e'}
def rect(d,box,c):
 x,y,xx,yy=map(round,box);d.rectangle((min(x,xx),min(y,yy),max(x,xx),max(y,yy)),fill=P.get(c,c))
def line(d,pts,c,w=1):d.line(pts,fill=P.get(c,c),width=w)
def mask(im,x,y,rows,pal=P):
 for j,row in enumerate(rows):
  for i,c in enumerate(row):
   if c!='.' and 0<=x+i<im.width and 0<=y+j<im.height:im.putpixel((int(x+i),int(y+j)),ImageColor.getrgb(pal[c])+((255,) if im.mode=='RGBA' else ()))
def poly(d,pts,c):d.polygon(pts,fill=P.get(c,c))
def ellipse(d,box,c):d.ellipse(box,fill=P.get(c,c))
RUN=[(-4,3,1),(0,5,0),(4,2,-1),(3,-2,0),(2,-4,1),(-1,-3,0),(-4,0,-1),(-5,3,0)]
STRIKE=[(-2,0,-4),(-3,1,-7),(-4,2,-9),(4,-1,8),(6,0,12),(4,1,9),(1,0,3),(0,0,0)]
STATES=['idle','run','strike','stagger','death','charge'];KINDS=['rifle','breaker','rocketeer','captain','crawler','spitter']
def soldier(kind,state,f):
 im=Image.new('RGBA',(64,64));d=ImageDraw.Draw(im);x,y=25,22
 if kind=='captain' and state=='strike' and f in (3,4,5):y+=5
 if kind=='breaker' and state=='strike' and f in (0,1,2):y+=3
 a,b,bob=RUN[f] if state in ('run','charge') else (0,0,[0,0,0,0,1,1,0,0][f]);lean=0
 if state=='strike':lean,bob,weapon=STRIKE[f]
 else:weapon=0
 if state=='stagger':lean=-[0,3,5,6,4,3,1,0][f];bob=[0,0,1,2,2,1,0,0][f]
 if state=='death':
  if f>4:
   mask(im,15,47,['....ooooooo................','..ootttttttooooo...........','.ottggggggttiiiioooo.......','otggttttttttiyycccco.......','.oooooosssooooobbbbo.......','......oooooo...oooo........']);return im
  y+=f*3;lean=-f*2
 x+=lean;y+=bob;hipx=25;hipy=y+17
 if kind=='captain' and state=='strike' and f in (3,4,5):hipy-=7
 if kind=='breaker' and state=='strike' and f in (0,1,2):hipy-=5
 if state=='strike' and f in (0,1,2):hipy+=2
 for side,leg in [(0,a),(1,b)]:
  hx=hipx+side*10;footx=hx+leg;knee=(hx+leg//2+(2 if side else -2),hipy+5)
  line(d,[(hx,hipy),knee,(footx,hipy+10)],'o',6);line(d,[(hx,hipy),knee,(footx,hipy+9)],'s',4)
  rect(d,(knee[0]-2,knee[1]-1,knee[0]+1,knee[1]+1),'g');mask(im,footx-3,hipy+9,['.ooooooo','oissycco','oiiiycco','oooooooo'])
 mask(im,x-7,y+4,['.oooooo','oycccco','oycbbbo','oiccbbo','oycccco','oybbbbo','.oooooo'])
 if kind in ('rocketeer','captain'):mask(im,x-10,y-1,['.ooooo','oyycco','oiycco','oyccbo','oybbbo','.ooooo','..rrr.','..ywy.'])
 if state=='charge':mask(im,x-18,y+8,['........y.','...r..ywy.','.rryrywwy.','rryywwwyr.','...rryyy..','......rr..'])
 mask(im,x-1,y+5,['..ooooooooooo..','.oiiiiiiiiyyco.','oiittgggggyycco','oittgggggsyycco','ottggggsstyycco','ottgggsssstccbo','ottggsssssyccbo','.otsssssssybbo.','..ooooyyyoooo..','..ottoccco....'])
 mask(im,x+1,y+15,['ooooooooooooo','ottttttyyyyco','ottgtttycccco','ottttttoooooo','ooooooo......'])
 rect(d,(x+5,y,x+10,y+7),'o');rect(d,(x+6,y+1,x+9,y+6),'c')
 if kind=='rifle':mask(im,x-1,y-9,['......ooooo......','....ootttttoo....','...otgggggttto...','..otggghhggtto...','.otgghhhgggttto..','otgghhhhgggtttto.','otgghoooooottsto.','ottgoiwwwwyottto.','.otgoiyyyyoottto.','..otoobbbboottto.','...ottooooottto..','....otttttttto...','.....ooooooo.....'])
 elif kind=='breaker':
  mask(im,x-4,y-9,['....ooooooooooo....','..ooiiiiiiiiiyyoo..','.oiiyyyyyyyyycccco.','oiiyyyyyyyyyyccccco','oiyyyyoooooooooccco','oiyyyossggggggsocco','oiyyyosggghhggsocco','oiyyyossssssssoocco','oyycccbbbbbbbbcccco','oyycccbbbbbbbbcccco','.oycciiiiiiiiccbo..','..oyccbbbbbbbbo....','...ooooooooooo.....'])
  mask(im,x-6,y+4,['..oooooooooooooooooo','ooiiiiiiiiyyyyyyyyyco','oiyyyyyyyyyycccccccco','oycccccccccccccccbbo','oycccccggggccccccbbo','oycccccggggccccccbbo','oycccccggggccccccbbo','oycccccggggccccccbbo','.obbbbbbbbbbbbbbbbo.'])
 elif kind=='rocketeer':
  mask(im,x+1,y-8,['...oooooooo....','..oryyyyrrro...','.oryyyyyrrrro..','oryyyyyyrrrrro.','orrrrrrrrrrrro.','ooooiiiooiiioo.','oowogwwooewwoo.','.oyoooooooyyo..','.oyyyybbbyyo...','..oyybbbyyo....','...ooooooo.....'])
  mask(im,x-1,y+6,['..ooooooooooooo','ooyycccccgggggo','oyyccccccgggggo','oyccccccccgggso','oyccccccccggsso','oyccccccccgssso','.oycccccggssso.','..oooooooosso..'])
 else:
  mask(im,x+1,y-11,['....oooooo....','..ooyyyycco...','.oyyyyyyccco..','oyyiiiyyyccco.','oyyiiwwyyyyco.','.oywwwwwwwyyo.','.oywwoooyywyo.','..oyyyyyyyyo..','..orccccccro..','..orccccccro..','...orrccrro...','....oooooo....'])
  mask(im,x-5,y+3,['..ooooooooooooooo..','.oiiiirrrrryycccco.','oiiiiryrrryyyccccco','oyyyryyrrryyyccccco','oyyyryrrrrryyccccbo','oyccryrrrrryycccbbo','oyccryrrryrrycccbbo','oyccrrryyrrrycccbbo','oyccrrryyrrrycccbbo','.oycrryrrryryccboo.','..oyccyyyyyyyccoo..','..oyccbbbbbbbccco..','..orrrrrrrrrrccco..'])
 if kind=='breaker':mask(im,x-6,y+4,['..oooooooooo','ooiiiiiiiiyo','oiyyyyyyycco','oycccccccboo','obbbbbbbboo.','.oooooooo...'])
 if kind=='rocketeer':mask(im,x-13,y-8,['..oooooooo.','.oiiiiiiyyo','oiyyyyyycco','oiyccccccbo','oiycccccboo','oiycccccboo','oiycccccboo','oycccccbbbo','oycccccbbbo','.ooooooooo.'])
 if kind=='captain':
  mask(im,x-7,y+15,['.oooooooooooo','oryyyrrryycco','orryrrryyycco','orrrrrooyccco','orrrrro.oycco','orrrro..oyyco','orrrro...oyco','orroo.....ooo','ooo..........'])
  mask(im,x-9,y+12,['ooo....','orryo..','oryyro.','orrrro.','orrro..','orro...','oro....'])
 armx=x+9+(2 if state=='strike' and f in (3,4) else 0);mask(im,armx,y+8,['.oooooo.','oiyyycco','oiycccco','oycccboo','.obbbbo.','..oooo..'])
 if state=='strike' and f in (0,1,2):mask(im,x-2,y+7,['.oooooooooooo','oiytttgggycco','oytttggggccbo','ottttggssccbo','.otttsssoooo.'])
 if kind=='rifle':
  wx=x+11+weapon//3;wy=y+11
  mask(im,wx,wy,['.....ooooooo.........','..ooossssssoooooooooo','ooyyyigggtttiiiiiiiio','oycccytttsttoooooooo.','.ooooyssssso.........','....oobboo...........','.....obbo............','......oo.............'])
  if state=='strike' and f in (3,4):mask(im,wx+32,wy-2,['...y....','..ywy...','yywwwyyy','.wwwww..','yywwwyyy','..ywy...','...y....'])
 elif kind=='breaker':
  mask(im,x+12+max(0,weapon//2),y+3,['..oooooooooo..','.oiiiiiiiiiyo.','oiiyyyyyyyycco','oiycccgggyycco','oiyccggggyccbo','oiyccggssyccbo','oiyccgsssyccbo','oiyccssssyccbo','oiyccssssyccbo','oiyccssssyccbo','oiyccssssyccbo','.oyccssssycbo.','..oyccssycbo..','...oyccycbo...','....oooooo....']);rect(d,(x+24+weapon//2,y+10,x+34+weapon//2,y+12),'i')
 elif kind=='rocketeer':mask(im,x+6,y-1,['....oooooooooooooooooo.','..oottttttttttttyyyyyyo','ooiigggggggggsstyyyycco','oiiiggggggggssstyyccbo','oooottttttttttttccbbbo','....ooooooooooooooooo.','..........obbo.........','...........oo..........'])
 else:
  if state=='strike':hx,hy=[(x+2,y-14),(x-7,y-19),(x-11,y-22),(x+15,y+1),(x+17,y+9),(x+15,y+8),(x+18,y+9),(x+19,y+8)][f]
  else:hx,hy=x+21,y+8
  elbow=(x+12,y+3) if state=='strike' and f<3 else (x+15,y+14)
  line(d,[(x+10,y+8),elbow,(hx+5,hy+12)],'o',5);line(d,[(x+10,y+8),elbow,(hx+5,hy+12)],'c',3)
  line(d,[(hx+5,hy+6),(hx+5,hy+19)],'o',4);line(d,[(hx+5,hy+6),(hx+5,hy+19)],'y',2)
  mask(im,hx,hy,['..oooooooooo..','.oiiiiiiyycco.','oiiyyyycccccbo','oiyycgggccccbo','oiyccgwgcccbo.','oycccgggccbbo.','oyccccccbbbbo.','.obbbbbbbboo..','..oooooooo....'])
  rect(d,(hx+1,hy-2,hx+12,hy-1),'i');rect(d,(hx+1,hy+8,hx+12,hy+10),'c');rect(d,(hx,hy+11,hx+12,hy+12),'o')
 return im

def bug(kind,state,f):
 im=Image.new('RGBA',(64,64));d=ImageDraw.Draw(im);y=33;x=19
 if state in ('run','charge'):y+=RUN[f][2]
 if state=='strike':x+=STRIKE[f][0];y+=[-4,-6,-5,3,4,2,1,0][f]
 if state=='stagger':x-=f//2
 if state=='death':
  if f>3:
   mask(im,13,47,['.....nnnnnnnnnn........','...nnvvuuuuuvvnn.......','..nvuullluuuuvvnnnn....','nnvvuuuuvvuuuuvvvvnnn..','.nnnnvvvvvvvvnnnnnnnn..','.....nnnnnnnnn.........']);return im
  y+=f*3
 for i in range(3):
  a=RUN[(f+i*2)%8][0] if state in ('run','charge') else [-2,0,1][i];points=[(x+5+i*8,y+5),(x+i*8-7,y+12),(x+i*8-9+a,y+20),(x+i*8-4+a,y+20)]
  line(d,points,'n',5);line(d,points,'u',2)
 mask(im,x,y-8,['......nnnnnnnnn........','....nnvvvvvvvvvnn......','...nvuuuuuuuuuvvvn.....','..nvuullllluuuvvvvn....','.nvuullllluuuuvvvvvn...','nvuullllluuuuuvvvvvvn..','nvuuuuuuuuvvvvvvvvvvn..','nvuuuuvvvvuuuuuvvvvvvn.','nvvuvvnnnvuuuuuvvvvvvn.','nvvvnn...nvvvuuvvvvvvn.','.nnn.....nnvvvvvvvvvn..','..........nnvvvvvvnn...','............nnnnnn.....'])
 line(d,[(x+14,y-6),(x+16,y),(x+14,y+6)],'n',2);line(d,[(x+23,y-4),(x+24,y+3),(x+22,y+10)],'n',2)
 mask(im,x+24,y+1,['..nnnnnnnn..','.nvvuuuvvvn.','nvulllluvvvn','nvuueeeuvvvn','nvunewenvvvn','.nvunnnvvvn.','..nvvvvvnn..','...nnnnnn...'])
 jaw=7 if state=='strike' and f in (3,4,5) else -2 if state=='strike' and f<3 else 0
 poly(d,[(x+31,y+7),(x+43+jaw,y+9),(x+45+jaw,y+15),(x+37,y+13),(x+33,y+12)],'n');line(d,[(x+32,y+8),(x+42+jaw,y+10),(x+42+jaw,y+13)],'l',2)
 poly(d,[(x+31,y+3),(x+39+jaw,y-4),(x+43+jaw,y-3),(x+40,y+4)],'n');line(d,[(x+32,y+2),(x+40+jaw,y-3)],'u',2)
 if kind=='spitter':
  mask(im,x+3,y-16,['.....nnnnnnn....','...nnvvveeevn...','..nvvveeeewenv..','.nvuueewweeevn..','nvuueeeeeevvvvn.','nvuuuuvvvvuvvvn.','.nvvvvvvvvvvvn..','..nnvvvvvvvnn...','....nnnnnnn.....'])
  for k in range(3):mask(im,x+4+k*5,y-18-k%2*2,['..n.','.nln','nuvn','.nn.'])
 return im
atlas=Image.new('RGBA',(512,2304))
for ki,kind in enumerate(KINDS):
 for si,state in enumerate(STATES):
  for f in range(8):atlas.paste((soldier if ki<4 else bug)(kind,state,f),(f*64,(ki*6+si)*64))
atlas.save(OUT/'units.png')
queen=Image.new('RGBA',(1024,128))
for f in range(8):
 im=Image.new('RGBA',(128,128));d=ImageDraw.Draw(im);bob=[0,0,1,1,0,-1,-1,0][f]
 for i in range(4):
  yy=62+i*6;xx=42+i*13;pts=[(xx,yy),(xx-19,yy+11),(xx-25+RUN[(f+i)%8][0],yy+30),(xx-17,yy+31)]
  line(d,pts,'n',9);line(d,pts,'v',5);line(d,pts,'u',2)
 for j in range(5):
  xx=25+j*13;yy=43-([0,10,13,8,0][j])+bob
  poly(d,[(xx-8,yy+9),(xx-2,yy),(xx+10,yy-2),(xx+21,yy+7),(xx+25,yy+25),(xx+19,yy+41),(xx,yy+37),(xx-11,yy+25)],'n')
  poly(d,[(xx-5,yy+9),(xx,yy+2),(xx+10,yy),(xx+18,yy+9),(xx+21,yy+24),(xx+15,yy+35),(xx,yy+32),(xx-8,yy+23)],'v')
  poly(d,[(xx-4,yy+9),(xx+1,yy+3),(xx+10,yy+2),(xx+16,yy+8),(xx+18,yy+18),(xx+9,yy+15),(xx,yy+21)],'u');line(d,[(xx-3,yy+9),(xx+2,yy+4),(xx+10,yy+3)],'l',2)
  for k in range(3):rect(d,(xx+k*4,yy+22+k%2*4,xx+k*4+1,yy+23+k%2*4),'e')
  poly(d,[(xx+4,yy),(xx+8,yy-13),(xx+13,yy-18),(xx+13,yy+2)],'n');line(d,[(xx+8,yy-3),(xx+11,yy-13)],'l',2)
 mask(im,92,58+bob,['.....nnnnnnnnnn....','...nnvvvuuuuuvvnn..','..nvvuuullllluuvvn.','.nvuuullleeeeluuvvn','nvuullllewweluuvvvn','nvuulllleeeeluuvvvn','nvuulllluuuluuvvvvn','.nvuullluuuuvvvvvn.','..nvvvvvvvvvvvvnn..','...nnnnnnnnnnnn....'])
 for yy,sgn in [(63,-1),(75,1)]:
  pts=[(105,yy),(119,yy+sgn*7),(125,yy+sgn*14),(115,yy+sgn*11)];line(d,pts,'n',7);line(d,pts,'l',3)
 queen.paste(im,(f*128,0))
queen.save(OUT/'brood.png')
r=random.Random(410);im=Image.new('RGB',(640,360),'#a3c8bf');d=ImageDraw.Draw(im)
for yy in range(170):rect(d,(0,yy,639,yy),(int(131+yy*.27),int(180+yy*.17),int(178-yy*.03)))
for x,y,w in [(35,25,130),(220,39,146),(440,14,180),(500,67,112)]:
 for xx,yy,ww in [(x,y,w),(x+10,y-4,w-35),(x+29,y-8,w-77),(x-7,y+3,w+23)]:rect(d,(xx,yy,xx+ww,yy+3),'#d5d9b5')
poly(d,[(0,108),(18,108),(18,100),(47,100),(47,91),(75,91),(75,96),(99,96),(99,115),(128,115),(128,82),(143,82),(143,69),(171,69),(171,90),(204,90),(204,116),(240,116),(240,99),(276,99),(276,105),(318,105),(318,79),(349,79),(349,87),(378,87),(378,114),(413,114),(413,102),(480,102),(480,89),(516,89),(516,111),(576,111),(576,79),(599,79),(599,99),(640,99),(640,200),(0,200)],'#759c94')
rect(d,(0,117,639,129),'#71988c');rect(d,(0,116,639,118),'#acc4a5')
for x in range(-10,650,58):
 rect(d,(x,129,x+11,187),'#71988c');poly(d,[(x+9,130),(x+22,130),(x+17,136),(x+11,145)],'#71988c');poly(d,[(x+47,130),(x+58,130),(x+58,147),(x+54,136)],'#71988c')
for xx,yy,ww in [(306,55,46),(365,84,33),(207,107,35)]:
 rect(d,(xx,yy,xx+ww,150),'#789987');rect(d,(xx-3,yy-3,xx+ww+3,yy),'#b0b79a')
 for wx in range(xx+7,xx+ww-3,12):rect(d,(wx,yy+9,wx+5,yy+23),'#527d75');rect(d,(wx,yy+9,wx+1,yy+22),'#97b199')
 rect(d,(xx+5,yy-9,xx+ww-8,yy-4),'#899f87')
 for yy2 in range(yy+28,148,13):line(d,[(xx,yy2),(xx+ww,yy2)],'#91a68c')
 for vx in range(xx+3,xx+ww,9):
  vy=yy+r.randrange(3,14);line(d,[(vx,vy),(vx+2,vy+20),(vx,vy+29)],'#5c886f',2);rect(d,(vx-2,vy+8,vx+3,vy+11),'#85a477')
for base,col,hi in [(120,'#527f70','#71945d'),(136,'#3e6b5d','#60804c')]:
 for x in range(-15,661,19):
  yy=base+r.randrange(-13,12);ellipse(d,(x,yy-17,x+34,yy+14),col);rect(d,(x,yy+4,x+34,210),col);line(d,[(x+8,yy-8),(x+14,yy-11),(x+22,yy-11)],hi,2)
rect(d,(0,280,639,359),'#4a655a');rect(d,(0,293,639,298),'#9caa7c')
for yy in range(300,360,15):
 for xx in range(-20,660,35):
  x=xx+(17 if yy%2 else 0);c=r.choice(['#617b63','#6c8063','#586f5c','#73876a']);rect(d,(x,yy,x+32,yy+12),c);line(d,[(x+1,yy+1),(x+31,yy+1)],'#8e9c72')
for x in [51,252,452]:
 poly(d,[(x,359),(x,325),(x+7,310),(x+17,300),(x+31,293),(x+71,293),(x+86,300),(x+96,312),(x+102,328),(x+102,359)],'#243f3e');poly(d,[(x+10,359),(x+10,329),(x+16,316),(x+31,306),(x+72,306),(x+86,316),(x+93,330),(x+93,359)],'#37625b')
 for k in range(7):
  a=math.pi+k*math.pi/6;xx=x+51+round(math.cos(a)*53);yy=331+round(math.sin(a)*43);rect(d,(xx-5,yy-5,xx+5,yy+5),'#839271');rect(d,(xx-4,yy-4,xx+4,yy-3),'#b0b38a')
poly(d,[(0,140),(640,140),(640,292),(0,292)],'#7c8d66')
for i in range(1600):
 x=r.randrange(640);y=r.randrange(142,292);c=r.choice(['#8e9c70','#6e825f','#a2a977','#637957']);rect(d,(x,y,x+r.randrange(1,5),y+r.randrange(0,2)),c)
for y in [180,263]:
 for x in range(-20,660,19):poly(d,[(x,y-4),(x+10,y-4),(x+14,y+10),(x+4,y+10)],'#596b53');line(d,[(x+1,y-3),(x+8,y-3)],'#a5a475')
 line(d,[(0,y),(640,y)],'#455f55',4);line(d,[(0,y-2),(640,y-2)],'#c6b884',1)
rect(d,(90,117,96,213),'#42574f');rect(d,(91,117,92,213),'#a98c58');rect(d,(66,112,124,118),'#485f52');rect(d,(68,110,122,111),'#ccb681')
for x in [78,104]:rect(d,(x,120,x+9,146),'#283f3c');rect(d,(x+2,123,x+6,129),'#cf8c50');rect(d,(x+2,135,x+6,141),'#496f61')
line(d,[(95,133),(108,147),(95,159),(108,174),(95,187)],'#718575',2)
rect(d,(8,147,51,213),'#3b5147');rect(d,(13,151,46,209),'#94683f');rect(d,(16,152,23,205),'#c59a5d');rect(d,(25,153,42,208),'#ac7847');rect(d,(5,144,54,151),'#4b5444');rect(d,(8,144,51,146),'#d4b877')
for y in [158,177,198]:
 line(d,[(13,y),(47,y)],'#674d36',2)
 for x in [15,44]:rect(d,(x,y-2,x+1,y-1),'#eee0a0')
line(d,[(35,148),(35,133),(53,127),(65,128)],'#384f46',12);line(d,[(35,147),(35,134),(53,129),(65,130)],'#b8864f',7);line(d,[(32,143),(32,134),(52,127)],'#dbba7c',2)
rect(d,(575,119,585,212),'#485648');rect(d,(577,120,579,208),'#b49056');line(d,[(580,125),(533,171)],'#46554a',8);line(d,[(580,124),(533,168)],'#bc9e65',2);rect(d,(531,116,633,124),'#46554a');rect(d,(532,116,632,118),'#d6ba7e');rect(d,(551,123,552,160),'#46554a');rect(d,(543,158,563,179),'#46554a');rect(d,(546,160,560,176),'#b57c48');rect(d,(548,161,553,173),'#d8ab67')
def fern(x,y,s=1):
 line(d,[(x,y),(x+4*s,y-14*s)],'#305749',1)
 for k in range(5):
  yy=y-k*3*s;xx=x+k*s;line(d,[(xx,yy),(xx-5*s+k//2,yy-3*s)],'#547e54',2);line(d,[(xx,yy),(xx+6*s-k//2,yy-4*s)],'#95aa62',2)
for x,y in [(7,219),(62,145),(133,145),(185,141),(477,141),(614,146),(635,145),(24,292),(159,291),(385,292),(601,294)]:fern(x,y)
for x in [0,159,383,632]:
 for j in range(25):
  xx=x+r.randrange(-15,22);yy=295+r.randrange(0,49);rect(d,(xx,yy,xx+4,yy+3),r.choice(['#3d6851','#547f56','#85a560']))
line(d,[(0,294),(640,294)],'#354f44',3);line(d,[(0,292),(640,292)],'#b8b483',2)
for side in [0,1]:
 flip=1 if side==0 else -1;bx=0 if side==0 else 640
 for branch in [[(0,8),(42,12),(71,32),(110,27)],[(24,11),(53,4),(95,5)],[(3,4),(8,36),(24,53)]]:line(d,[(bx+x*flip,y) for x,y in branch],'#384e35',7)
 for x,y,rad in [(-4,5,25),(23,1,18),(46,11,23),(69,26,17),(90,29,15),(12,28,17),(13,44,14),(48,-5,27),(79,2,16),(114,22,9)]:
  xx=bx+x*flip;yy=y+(4 if side else 0);poly(d,[(xx-rad,yy),(xx-rad+3,yy-8),(xx-5,yy-12),(xx+rad-4,yy-8),(xx+rad,yy+2),(xx+rad-6,yy+10),(xx-4,yy+11)],'#375c40');poly(d,[(xx-rad+2,yy-2),(xx-rad+7,yy-8),(xx-5,yy-10),(xx+rad-6,yy-6),(xx+rad-4,yy),(xx+2,yy+3)],'#688849' if side==0 else '#4f774c')
  for k in range(3):mask(im,xx-rad+7+k*6,yy-5+k%2*3,['..h..','.hgh.','hggg.','.gt..','..t..'],{'h':'#b0b76a','g':'#8fa355','t':'#577b43'})
 for xx,yy,length in [(31,28,28),(70,36,17),(105,32,24)]:
  x=bx+xx*flip;line(d,[(x,yy),(x+2,yy+length//2),(x-1,yy+length)],'#446b43')
  for j in range(3):rect(d,(x-2,yy+8+j*6,x+2,yy+9+j*6),'#86a05a')
im.save(OUT/'aqueduct.png')
font=ImageFont.load_default();sheet=Image.new('RGB',(1200,810),'#172d35');sd=ImageDraw.Draw(sheet)
for ki,kind in enumerate(KINDS):
 sd.text((14,ki*134+8),kind.upper(),fill='#e6d8a1',font=font)
 for f in range(8):
  sp=atlas.crop((f*64,(ki*6+2)*64,(f+1)*64,(ki*6+3)*64)).resize((128,128),Image.Resampling.NEAREST);sheet.paste(sp,(150+f*128,ki*134),sp)
sheet.save(ROOT/'docs/art-direction/emberwatch/sprite-contact.png')
print('Authored native pixel sprites, brood engine, aqueduct and contact sheet.')
