"""Porcelain Front — original Blender 4.5 miniature siege, 864 authored frames.
Rebuild: blender -b -t 4 --python build_scene.py -- --output /absolute/output --render
49 mechanical miniatures; 36 seconds. Rendered on twos at12distinctfps, delivered24fps.
All meshes, materials, hierarchy rigs, camera, lighting and keys authored here.
"""
import bpy, math, random, os, sys, argparse
from mathutils import Vector
random.seed(41)
p=argparse.ArgumentParser();p.add_argument('--output',default='/tmp/porcelain-front');p.add_argument('--frame',type=int,default=467);p.add_argument('--render',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
os.makedirs(a.output,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
S=bpy.context.scene;S.render.engine='BLENDER_EEVEE_NEXT';S.render.resolution_x=960;S.render.resolution_y=540;S.render.resolution_percentage=100;S.render.fps=24;S.frame_start=1;S.frame_end=864;S.frame_step=2
S.render.image_settings.file_format='PNG';S.render.filepath=os.path.join(a.output,'frames','frame_');S.render.threads_mode='FIXED';S.render.threads=4;S.eevee.taa_render_samples=16
S.world.color=(.16,.20,.26);S.world.use_nodes=True;S.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.19,.25,1);S.world.node_tree.nodes['Background'].inputs[1].default_value=.35
S.view_settings.view_transform='AgX';S.view_settings.look='AgX - Medium High Contrast';S.render.film_transparent=False

def mat(name,c,metal=0,rough=.35,emit=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*c,1);n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough
 if emit:n.inputs['Emission Color'].default_value=(*c,1);n.inputs['Emission Strength'].default_value=emit
 return m
ivory=mat('01 | fired ivory glaze',(.85,.88,.79),.25,.24);gold=mat('02 | brushed champagne brass',(.60,.37,.12),.8,.30);ink=mat('03 | deep midnight enamel',(.022,.059,.085),.45,.29);coral=mat('04 | vermilion ceramic',(.73,.115,.044),.22,.29);dark=mat('05 | exposed graphite mechanism',(.035,.038,.045),.6,.46);blue=mat('06 | cobalt porcelain',(.024,.16,.30),.35,.27);snow=mat('07 | chalk snow',(.65,.74,.74),0,.82);stone=mat('08 | basalt slate',(.033,.075,.088),.2,.73);glow=mat('09 | hot amber furnace',(1,.28,.035),.25,.3,2);cold=mat('10 | pale electric teal',(.20,.85,.86),.2,.3,1.5);dust=mat('11 | clay dust',(.45,.22,.12),0,.8)
def parent(o,root):
 if root:o.parent=root
 return o
def finish(o,name,ma,root=None):
 o.name=name;o.data.materials.append(ma)
 for f in o.data.polygons:f.use_smooth=True
 return parent(o,root)
def sphere(name,pos,scale,ma,root=None):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=pos);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,ma,root)
def ico(name,pos,scale,ma,root=None):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=pos);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,ma,root)
def rod(name,start,end,r,ma,root=None,r2=None):
 delta=Vector(end)-Vector(start);bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=r,radius2=r if r2 is None else r2,depth=delta.length,location=(Vector(start)+Vector(end))/2);o=bpy.context.object;o.rotation_euler=delta.to_track_quat('Z','Y').to_euler();return finish(o,name,ma,root)
def cube(name,pos,scale,ma,root=None,bevel=.06):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,name,ma,root)
 if bevel:m=o.modifiers.new('small machined chamfer','BEVEL');m.width=bevel;m.segments=2;o.modifiers.new('weighted corner normals','WEIGHTED_NORMAL')
 return o
def ring(name,pos,major,minor,ma,root=None,rotation=(0,0,0)):
 bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=6,location=pos,major_radius=major,minor_radius=minor,rotation=rotation);return finish(bpy.context.object,name,ma,root)
def empty(name,root=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);return parent(o,root)
def key(o,f,loc=None,rot=None,scale=None):
 if loc is not None:o.location=loc;o.keyframe_insert('location',frame=f)
 if rot is not None:o.rotation_euler=rot;o.keyframe_insert('rotation_euler',frame=f)
 if scale is not None:o.scale=scale if hasattr(scale,'__len__') else (scale,)*3;o.keyframe_insert('scale',frame=f)
def combine(root,name):
 obs=[o for o in root.children if o.type=='MESH'];bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 if not obs:return
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.convert(target='MESH')
 if len(obs)>1:bpy.ops.object.join()
 o=bpy.context.object;o.name=name;return o

# Layered miniature terrace, recessed canal, warm brass seams and real geometry.
cube('floating basalt plinth',(0,0,-.75),(27.5,18.5,1.2),stone,bevel=.6)
cube('brass seam around diorama',(0,0,-.2),(27.7,18.7,.12),gold,bevel=.5)
for side in [-1,1]:cube('raised snow embankment',(side*7.8,0,.0),(11.6,18.2,.45),snow,bevel=.42)
cube('sunken obsidian canal',(0,0,-.08),(4.2,18,.12),ink,bevel=.12)
for y in range(-8,9,2):cube('submerged brass conduit',(0,y,-.01),(3.6,.11,.05),gold,bevel=.02)
for x in [-2.1,2.1]:
 for y in [-7,-3,1,5,8]:
  cube('route marker',(x,y,.2),(.32,.8,.18),ink);cube('amber route light',(x,y,.32),(.20,.18,.06),glow)
for x,y in [(-11,-6),(10,6)]:
 base=empty('substation');cube('substation base',(x,y,.35),(2.4,1.4,.6),stone,base,.12)
 for xx in [-.75,0,.75]:
  rod('ceramic insulator',(x+xx,y,.5),(x+xx,y,1.65),.16,ivory,base)
  for z in [1,1.3,1.6]:ring('brass cooling flange',(x+xx,y,z),.25,.05,gold,base)
 rod('power bus',(x-1,y,1.78),(x+1,y,1.78),.07,gold,base)
for i in range(100):
 x=random.uniform(-13,13);y=random.uniform(-8.5,8.5)
 if abs(x)<2:continue
 ico('snow crust',(x,y,.16),(random.uniform(.1,.5),random.uniform(.1,.4),random.uniform(.04,.12)),ivory)
for side in [-1,1]:
 for j in range(22):
  y=-8.5+j*.8;ico('chipped canal lip',(side*(2.1+random.uniform(-.12,.18)),y,.02),(.24,.48,.28),stone)
  if j%3:ico('wind sculpted snow',(side*(2.45+random.uniform(0,.3)),y,.22),(.65,.8,.15),ivory)
 for j in range(8):
  x=side*(3.5+j*1.2);cube('rear retaining wall',(x,8.5,.5),(1.0,.38,.55+random.random()*.25),stone,bevel=.05)
  if j%3!=1:rod('broken brass railing',(x,8.5,.7),(x,8.5,1.3),.045,gold)
 for j in range(6):
  x=side*(4+random.random()*8);y=random.choice([-7.8,7.6]);ico('wind bank',(x,y,.29),(1.15,.55,.2),ivory)
for x,y in [(-10,6.5),(11,-5.7)]:
 ring('fallen turbine collar',(x,y,.75),.86,.19,stone,rotation=(.8,.2,.3));ring('exposed turbine copper',(x,y,.75),.76,.055,gold,rotation=(.8,.2,.3))
 for j in range(5):ico('shattered turbine stator',(x+random.uniform(-1.3,1.3),y+random.uniform(-.8,.8),.3),(.35,.18,.16),stone)
for x,h in [(-12,3),(-7,1.9),(6,2.2),(12,3.6)]:
 cube('pylon foundation',(x,8,.4),(1.1,1,.5),stone);rod('signal spire',(x,8,.4),(x,8,h),.18,ink);ring('receiver hoop',(x,8,h),.55,.065,gold,rotation=(math.pi/2,0,0));rod('antenna needle',(x,8,h),(x,8,h+.9),.04,gold)

# Five silhouettes, each an articulated hierarchy with body, weapon and six leg pivots.
def model(kind):
 root=empty('TEMPLATE '+kind);body=empty('carapace assembly',root);white=kind!='foundry';shell=ivory if white else coral;trim=gold if white else dark
 sphere('black abdomen',(0,0,.75),(.72,.48,.38),ink,body)
 for side in [-1,1]:
  o=sphere('separate glazed elytron',(-.12,side*.20,.93),(.66,.28,.26),shell,body);o.rotation_euler.x=side*.2
  rod('brass elytron edging',(-.67,side*.13,1.02),(.43,side*.13,1.11),.026,trim,body)
  for x in [-.5,-.23,.04,.30]:sphere('enamel rivet',(x,side*.39,1.03),(.035,)*3,trim,body)
 sphere('masked pilot head',(.55,0,.93),(.29,.35,.30),shell,body);sphere('dark visor',(.77,0,.97),(.10,.28,.12),ink,body)
 for y in [-.12,.12]:sphere('inset optic',(.857,y,1),(.035,.053,.035),cold if white else glow,body)
 for y in [-.17,.17]:
  rod('antenna',(.53,y,1.15),(.71,y*1.6,1.47),.026,trim,body);sphere('antenna bead',(.71,y*1.6,1.47),(.048,)*3,cold if white else glow,body)
 if kind=='lancer':
  for y in [-.37,.37]:ico('cobalt shoulder',(.22,y,1.10),(.37,.11,.24),blue,body)
  rod('ceramic dorsal crest',(-.48,0,1.03),(-.62,0,1.8),.17,ivory,body,r2=.01);weapon=empty('lance recoil',root)
  rod('brass lance barrel',(.35,-.47,1.05),(1.62,-.47,1.12),.075,gold,weapon);rod('ivory lance tip',(1.6,-.47,1.12),(2.2,-.47,1.17),.12,ivory,weapon,r2=0);ring('lance induction collar',(.54,-.47,1.06),.15,.03,cold,weapon,(0,math.pi/2,0))
 elif kind=='bulwark':
  sphere('enormous ivory ram shield',(.58,0,1.10),(.24,.86,.65),ivory,body);sphere('cobalt shield boss',(.79,0,1.17),(.09,.28,.30),blue,body)
  for yy in [-.64,.64]:rod('shield gold edge',(.63,yy,.63),(.66,yy,1.48),.041,gold,body);rod('forward ivory tusk',(.40,yy,.55),(1.60,yy,.54),.12,gold,body,r2=.018)
  weapon=empty('shield ram hinge',root);rod('ram spine',(.3,0,1.2),(1.3,0,1.35),.055,gold,weapon)
 elif kind=='mortar':
  sphere('wide low gun carriage',(-.25,0,.67),(.84,.77,.30),ink,body)
  for yy in [-.67,.67]:
   sphere('heavy cobalt sponson',(-.28,yy,.92),(.73,.23,.32),blue,body)
   for xx in [-.63,-.2,.25]:ring('wheel-like recoil damper',(xx,yy,.7),.16,.055,gold,body,rotation=(math.pi/2,0,0))
  for y in [-.45,.45]:
   wing=sphere('cobalt artillery mantle',(-.25,y,1.2),(.63,.28,.16),blue,body);wing.rotation_euler.x=y*.8
  weapon=empty('mortar elevation',root);weapon.location=(-.2,0,1);rod('artillery neck',(0,0,0),(.2,0,.6),.17,gold,weapon);rod('porcelain mortar',(.15,0,.45),(.5,0,1.3),.22,ivory,weapon);rod('dark open muzzle',(.49,0,1.29),(.51,0,1.34),.16,ink,weapon)
  for z in [.6,.84,1.08]:ring('breech rings',(.2+(z-.45)*.41,0,z),.235,.035,gold,weapon,rotation=(0,.39,0))
 elif kind=='conductor':
  for side in [-1,1]:
   for j in range(3):
    vane=sphere('porcelain crown vane',(-.40-j*.18,side*(.55+j*.36),1.42+j*.27),(.54,.12,.70),ivory,body);vane.rotation_euler=(side*-.35,-.35-j*.1,side*.15)
    rod('gold vane vein',(-.15,side*.45,1.06),(-.70-j*.18,side*(.70+j*.36),2.0+j*.20),.035,gold,body)
  for yy in [-.24,0,.24]:rod('crown prong',(.52,yy,1.10),(.75,yy*1.6,2.1-abs(yy)),.062,gold,body,r2=.008)
  ring('conductor halo',(-.45,0,2.5),.50,.047,gold,body,(math.pi/2,0,0));sphere('halo core',(-.45,0,2.5),(.13,)*3,cold,body);weapon=empty('conductor crown articulation',root)
  for y in [-.55,.55]:rod('relay wand',(.2,y,1),(1.1,y*1.2,1.9),.055,gold,weapon,r2=.02)
 else:
  for x in [-.55,-.25,.05]:rod('furnace dorsal exhaust',(x,0,1.04),(x-.1,0,1.54),.10,dark,body)
  weapon=empty('crusher claw articulation',root)
  for side in [-1,1]:
   rod('claw elbow',(.30,side*.4,.8),(.9,side*.7,.9),.11,dark,weapon);sphere('heavy red crusher',(.97,side*.66,1.0),(.43,.22,.26),coral,weapon);rod('hooked pincer',(1.15,side*.65,1.02),(1.51,side*.42,.87),.17,coral,weapon,r2=.035);rod('inner pincer',(1.08,side*.47,.95),(1.33,side*.37,1.12),.09,gold,weapon,r2=.025)
 combine(body,'joined detailed '+kind+' shell');combine(weapon,'joined '+kind+' weapon');legs=[]
 for side in [-1,1]:
  for j,x in enumerate([-.5,0,.45]):
   leg=empty('leg pivot '+str(side)+' '+str(j),root);leg.location=(x,side*.31,.74);end=(-.25+(.25*j),side*.68,-.22)
   rod('brass upper femur',(0,0,0),end,.061,trim,leg);sphere('black ball joint',end,(.105,)*3,dark,leg);toe=(end[0]+.15,side*.92,-.64);rod('curved porcelain greave',end,toe,.09,shell,leg,r2=.04);sphere('gold tarsus',toe,(.14,.10,.055),trim,leg);combine(leg,'joined articulated leg');legs.append(leg)
 return root,body,weapon,legs

def clone(template,name):
 mapping={}
 def rec(src,p=None):
  o=src.copy();o.data=src.data;bpy.context.collection.objects.link(o);o.parent=p;mapping[src]=o
  for c in src.children:rec(c,o)
  return o
 root=rec(template[0]);root.name=name;return root,mapping[template[1]],mapping[template[2]],[mapping[l] for l in template[3]]
T={k:model(k) for k in ['lancer','bulwark','mortar','conductor','foundry']};units=[]
for side in [-1,1]:
 for row in range(5):
  for col in range(5):
   if side==-1 and row==2 and col in [3,4]:continue
   kind=('mortar' if col==4 else ('bulwark' if col==0 else 'lancer')) if side<0 else 'foundry'
   x=side*(3.8+col*1.65)+random.uniform(-.22,.22);y=-5.8+row*2.65+(col%2)*.35+random.uniform(-.15,.15)
   root,body,weapon,legs=clone(T[kind],f'{kind} / rank {row+1} file {col+1}');units.append((root,body,weapon,legs,kind,side,row,col,x,y))
hero=clone(T['conductor'],'THE CONDUCTOR / crown relay');hero[0].scale=(1.45,)*3;units.append((*hero,'conductor',-1,2,6,-10,0))
for tpl in T.values():
 for o in [tpl[0],*list(tpl[0].children_recursive)]:bpy.data.objects.remove(o,do_unlink=True)

# Authored approach, staggered recoil, collision-range charge, pulse, then reform.
for idx,(root,body,weapon,legs,kind,side,row,col,x,y) in enumerate(units):
 facing=0 if side==-1 else math.pi;dead=(side==1 and col<2 and row in [0,2,4]) or (side==-1 and col==1 and row in [1,3]);hit=440+row*8 if side==-1 else (330+row*12 if col==0 else 673+row*5)
 pos=lambda advance:(x-side*advance,y+math.sin(row*2.3+col)*advance*.20,.22)
 for f,adv in [(1,0),(72,0),(190,1.1),(230,1.3),(380,1.3),(420,1.1 if side==-1 else 1.7),(470,(3.0 if col<2 else 1.4) if side==-1 else 2.7),(580,(3.0 if col<2 else 1.4) if side==-1 else 2.7),(650,(2.8 if col<2 else 1.5) if side==-1 else 2.5),(700,(2.8 if col<2 else 1.5) if side==-1 else 3),(770,1.9 if side==-1 else 2.6),(864,2.1 if side==-1 else 2.4)]:key(root,f,loc=pos(adv),rot=(0,0,facing))
 for f in range(1,865,8):
  moving=(72<f<230 or 398<f<470 or 744<f<840)
  for li,leg in enumerate(legs):
   phase=f*.23+li*math.pi+(idx%4)*.5;key(leg,f,rot=(math.sin(phase)*.24 if moving else 0,math.cos(phase)*.18 if moving else 0,math.sin(phase)*.19 if moving else 0))
  if moving:key(body,f,loc=(0,0,abs(math.sin(f*.23))*.055))
 if kind=='mortar':
  for fire in [242+row*8,290+row*8,340+row*8]:key(weapon,fire-18,rot=(0,-.25,0));key(weapon,fire-2,rot=(0,-.45,0));key(weapon,fire,rot=(0,.18,0));key(weapon,fire+12,rot=(0,0,0))
 elif kind in ['lancer','bulwark']:
  for charge in [433+row*7,495+row*7]:key(weapon,charge-12,loc=(-.25,0,.06));key(body,charge-12,rot=(0,-.25,0));key(weapon,charge,loc=(.40,0,0));key(body,charge,rot=(0,.24,0));key(weapon,charge+10,loc=(0,0,0));key(body,charge+12,rot=(0,0,0))
 elif kind=='foundry':
  for attack in [445+row*7,514+row*7]:key(weapon,attack-15,rot=(0,-1.05,0));key(body,attack-15,rot=(0,-.24,0));key(weapon,attack,rot=(0,.60,0));key(body,attack,rot=(0,.26,0));key(weapon,attack+18,rot=(0,0,0));key(body,attack+20,rot=(0,0,0))
 else:
  for f,r,z in [(1,0,0),(570,0,0),(606,-.18,.25),(634,-.22,.4),(650,.15,.12),(666,0,0)]:key(body,f,rot=(0,r,0),loc=(0,0,z))
  for f,r in [(570,0),(622,-.65),(642,-.85),(650,.2),(670,0)]:key(weapon,f,rot=(0,r,0))
 if dead:
  for fc in root.animation_data.action.fcurves:
   for ki in range(len(fc.keyframe_points)-1,-1,-1):
    if fc.keyframe_points[ki].co.x>=hit:fc.keyframe_points.remove(fc.keyframe_points[ki])
  base=pos(1.3 if hit<400 else 2.5);key(root,hit-1,loc=base,rot=(0,0,facing));key(root,hit+4,loc=(base[0]+side*.25,y,.8),rot=(.4,side*.3,facing+.15));key(root,hit+19,loc=(base[0]+side*.65,y,.38),rot=(1.42,side*.13,facing+.2));key(root,864,loc=(base[0]+side*.65,y,.38),rot=(1.42,side*.13,facing+.2))
  for mechanism in [body,weapon,*legs]:
   if mechanism.animation_data:
    for fc in mechanism.animation_data.action.fcurves:
     for ki in range(len(fc.keyframe_points)-1,-1,-1):
      if fc.keyframe_points[ki].co.x>=hit:fc.keyframe_points.remove(fc.keyframe_points[ki])
  for leg in legs:
   for f in [hit+15,864]:key(leg,f,rot=(0,.65,.15))
 elif side==1:
  for f,rx in [(648+row*3,0),(674+row*3,-.45),(701+row*3,-.15),(738,0)]:key(body,f,rot=(0,rx,0))

# Geometric ballistics and permanent shrapnel.
for row in range(5):
 for volley in range(3):
  start=242+row*8+volley*48;end=start+43;sx=-9.1;sy=-5.8+row*2.65;tx=2.5+volley*.38;ty=sy+.25
  o=sphere('arcing brass shell',(sx,sy,2.2),(.10,)*3,glow);key(o,1,scale=0);key(o,start-1,loc=(sx,sy,2.2),scale=0);key(o,start,scale=1)
  for j in range(9):
   t=j/8;key(o,start+j*(end-start)/8,loc=(sx+(tx-sx)*t,sy+(ty-sy)*t,2.2*(1-t)+.3*t+4*math.sin(math.pi*t)))
  key(o,end+1,scale=0);key(o,864,scale=0)
  for j in range(7):
   theta=j*math.tau/7;debris=ico('salvo ceramic fragment',(tx,ty,.3),(.09,.12,.09),coral if j%2 else gold);key(debris,1,scale=0);key(debris,end-1,scale=0);key(debris,end,scale=1);key(debris,end+8,loc=(tx+math.cos(theta)*.7,ty+math.sin(theta)*.7,.5+(j%3)*.3),rot=(j,.5,j*.8));key(debris,end+20,loc=(tx+math.cos(theta)*1.15,ty+math.sin(theta)*1.15,.22),rot=(j+2,.8,j))
  shock=ring('mortar pressure ring',(tx,ty,.25),.7,.04,glow);key(shock,1,scale=0);key(shock,end-1,scale=0);key(shock,end,scale=.1);key(shock,end+8,scale=1.4);key(shock,end+15,scale=0)
for k in range(6):
 o=ring('conductor wavefront',(-8,0,.5),1,.033,cold,rotation=(math.pi/2,0,math.pi/2));key(o,1,scale=0);key(o,642+k*3,scale=0);key(o,646+k*3,scale=1);key(o,669+k*3,loc=(5,0,.8),scale=5.8);key(o,688+k*3,loc=(8,0,.9),scale=0)
for yy in [-5.5,-2.8,2.8,5.5]:
 cube('narrow ceramic crossing',(0,yy,.17),(4.25,1.2,.16),ivory,bevel=.05)
 for xx in [-1.8,1.8]:cube('crossing brass cap',(xx,yy,.27),(.1,1.2,.07),gold,bevel=.01)
for j in [-1,0,1]:
 o=cube('breakable canal crossing',(0,j*.82,.33),(3.8,.76,.16),ivory,bevel=.05);key(o,1,loc=(0,j*.82,.33),rot=(0,0,0));key(o,656,loc=(0,j*.82,.33),rot=(0,0,0));key(o,670,loc=(j*.25,j*.82,.9+abs(j)*.25),rot=(j*.3,.35,j*.15));key(o,701,loc=(j*.35,j*.9,.24),rot=(j*.1,j*.13,j*.19));key(o,864,loc=(j*.35,j*.9,.24),rot=(j*.1,j*.13,j*.19))
def light(name,pos,energy,color,size):
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.name=name;o.data.energy=energy;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
light('warm gallery key',(-9,-8,17),2300,(1,.82,.61),9);light('glacial fill',(5,10,13),1900,(.50,.74,1),8);light('porcelain rim',(-10,9,8),1700,(.65,.90,1),6)
bpy.ops.object.light_add(type='SUN',location=(0,0,10));bpy.context.object.rotation_euler=(.5,-.5,-.5);bpy.context.object.data.energy=1.6;bpy.context.object.data.angle=.10
bpy.ops.object.camera_add(location=(20,-29,24));cam=bpy.context.object;cam.name='Diorama camera / continuous authored dolly';S.camera=cam;cam.data.type='ORTHO';cam.data.lens=45
for f,pos,target,scale in [(1,(20,-29,25),(0,0,.2),34),(190,(17,-28,24),(0,0,.4),32),(360,(14,-28,24),(0,0,.4),31),(530,(12,-28,25),(0,0,.5),31),(660,(15,-29,27),(0,0,.5),32),(864,(20,-29,26),(0,0,.25),34)]:key(cam,f,loc=pos,rot=(Vector(target)-Vector(pos)).to_track_quat('-Z','Y').to_euler());cam.data.ortho_scale=scale;cam.data.keyframe_insert('ortho_scale',frame=f)
for f,name in [(1,'I / PROCESSION'),(193,'II / CERAMIC RAIN'),(409,'III / FOUNDRY COUNTERCHARGE'),(577,'IV / THE CONDUCTOR'),(721,'V / AFTERMATH')]:S.timeline_markers.new(name,frame=f)
S['art_direction']='Porcelain Front / actual Blender authored miniature siege';S['units']=49;S['duration_seconds']=36;S['native_render_fps']=12;S['delivery_fps']=24;S['source']='Original procedural meshes, materials and keyed mechanical hierarchy rigs. No third-party art.';S.frame_set(a.frame)
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.color_type='MATERIAL'
about=bpy.data.texts.new('ABOUT PORCELAIN FRONT');about.write('49 original mechanical miniatures. 36 seconds. Timeline: 24 fps, rendered on twos at 12 distinct fps. Mechanical rigs use keyed object hierarchies: root, body, weapon and six leg pivots. Five chapter markers label the narrative. All geometry, materials and source are original. This is an editable prerender study, not a realtime simulation.\n')
if os.path.isfile(__file__):bpy.data.texts.load(__file__)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(a.output,'porcelain-front.blend'),compress=True)
S.render.filepath=os.path.join(a.output,f'art-frame-{a.frame:04d}.png');bpy.ops.render.render(write_still=True)
if a.render:S.render.filepath=os.path.join(a.output,'frames','frame_');bpy.ops.render.render(animation=True)
