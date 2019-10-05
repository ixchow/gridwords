OS := $(shell uname)

ifeq ($(OS), Linux)
	BLENDER=../../blender-2.80-linux-glibc217-x86_64/blender
else
	BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
endif

all : \
	gridwords.pnct \

gridwords.pnct : gridwords.blend export-meshes.py
	$(BLENDER) --background --python export-meshes.py -- gridwords.blend:Meshes '$@'
