//This module just abstracts all the 3d drawing/undrawing of faces away from 3d.js. 

//It's not used by the program: I may have started writing the lib here and then moved over to 3d.js and this could all be obsolute/incomplete.

"use strict";

class FaceModel{
	constructor(){
		this.x1 = 0;
		this.x2 = 0;
		this.y1 = 0;
		this.y2 = 0;
		this.z1 = 0;
		this.z2 = 0;
	}
}

var Draw3d = class{
	constructor(){}

	expand(tile, material, face, direction){
		if("Is there a face in the given direction with the same material?"){
			if("Is the width of the face the same as the current width of face?"){
					"Expand the existing face to incorporate face";
					return "the existing face";
			}
			else return face;
		}
		else{
			return face;
		}
	}

	//Undraws a surface. If the surface is connected to a larger face, redraw everything.
	undraw(tile, material, surface, directions){
		let face = tile.face; //tile.face is undefined.
		"Delete face from the mesh.";
		directions.forEach(direction => {
			this.drawExpandFace(tile[direction], material, surface, directions);
		});
		this.drawExpandFace(tile, material, surface, directions);
	}
		
	drawExpandFace(object, material, surface, directions){
		if(false && "Is the surface of this tile already drawn (and has a different texture)"){
			this.undraw(object, material, surface, directions)
		}
		else{	
			let face = new FaceModel("1x1 @ tile's position"); //FIXME: need to set position here.
			let oldface = null;
			let mergesFound = false;
			while(oldface != face){
				let oldface = face;
				directions.forEach(direction => {
					face = this.expand(object, material, face, direction);
					mergesFound = mergesFound || (oldface != face);
				});
			} 
			
			if(!mergesFound){
				//TODO:
				//Draw square.
				throw "Not implemented."
			}
			Mesh.needsupdate = true;
		}
	}

	drawTile(tile){
		let north = "north";
		let east = "east";
		let south = "south";
		let west = "west";
		this.drawExpandFace(tile, tile.floorMaterialIndex, "top", [north, west, south, east]);
		this.drawExpandFace(tile, tile.bottomMaterialIndex, "bottom", [north, west, south, east]);
		//The edges will be drawn slightly into the tile, so that they get drawn under walls.
		//This is MUCH simpler than having a smart system that doesn't draw some edges if a wall is present.
		//In particular, because that system may actually cause MORE faces to be drawn in the case of a tile being broken up.
		//However, this will result in redundant faces being drawn inside the mesh. So there should be a way of dealing with that for the final render.
		this.drawExpandFace(tile, tile.floorMaterialIndex, "northedge", [west, east]);
		this.drawExpandFace(tile, tile.floorMaterialIndex, "westedge", [north, south]);
		this.drawExpandFace(tile, tile.floorMaterialIndex, "southedge", [west, east]);
		this.drawExpandFace(tile, tile.floorMaterialIndex, "eastedge", [north, south]);

		this.drawExpandFace(tile, collider, "top", [north, west, south, east]);
	}

	drawWall(wall){
		
	}
}

Draw3d = new Draw3d();