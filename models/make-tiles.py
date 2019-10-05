
import bpy

tile_base = bpy.data.objects['Tile.Base']
text_base = bpy.data.objects['Text.Base']


#letters = "nothig"
letters = "abcdefghijklmnopqrstuvwxyz"

for i in range(0,len(letters)):

	letter = letters[i]

	x = (i+1) * 2


	bpy.ops.object.select_all(action='DESELECT')
	bpy.context.view_layer.objects.active = text_base
	text_base.select_set(True)
	bpy.ops.object.duplicate()
	bpy.ops.transform.translate(value=(x,0,0))
	bpy.context.object.data.body = letter
	bpy.ops.object.convert(target='MESH')
	bpy.ops.object.editmode_toggle()
	bpy.ops.mesh.select_all(action='SELECT')
	bpy.ops.mesh.remove_doubles()

	#old_pivot = bpy.context.scene.tool_settings.transform_pivot_point
	#bpy.context.scene.tool_settings.transform_pivot_point = 'BOUNDING_BOX_CENTER'
	#bpy.ops.view3d.snap_cursor_to_selected()
#	bpy.context.scene.cursor.location.z = old_location.z
	#bpy.context.scene.tool_settings.transform_pivot_point = old_pivot

	bpy.ops.object.editmode_toggle()

	bpy.ops.paint.vertex_paint_toggle()
	bpy.data.brushes["Draw"].color = (0, 0, 0)
	bpy.ops.paint.vertex_color_set()
	bpy.ops.paint.vertex_paint_toggle()

	old_location = bpy.context.object.location.copy()
	bpy.ops.object.origin_set(type='GEOMETRY_ORIGIN', center='BOUNDS')
	bpy.context.object.location.x = old_location.x
	bpy.context.object.location.y = old_location.y

	text = bpy.context.object

	bpy.ops.object.select_all(action='DESELECT')
	bpy.context.view_layer.objects.active = tile_base
	tile_base.select_set(True)
	bpy.ops.object.duplicate()
	bpy.ops.transform.translate(value=(x,0,0))
	bpy.ops.object.modifier_add(type='BOOLEAN')
	bpy.context.object.modifiers['Boolean'].object = text
	bpy.ops.object.convert(target='MESH')
	bpy.ops.transform.translate(value=(0,-2,0))
	tile = bpy.context.object

	tile.name = "Tile." + letter.upper()
	tile.data.name = "Tile." + letter.upper()

	bpy.ops.object.select_all(action='DESELECT')
	bpy.context.view_layer.objects.active = text
	text.select_set(True)
	bpy.ops.object.delete(use_global=False)


