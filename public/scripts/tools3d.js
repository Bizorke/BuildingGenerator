"use strict";

//import { ENGINE_METHOD_CIPHERS } from "constants";

var Tools3d = new (class{
	constructor(){
		this.Tool = class{
			constructor(name, start, move, end){
				this.name = name;
				this.start = start;
				this.move = move;
				this.end = end;
			}
		}

		this.Tools = new Enum(["pointer", "tiles", "walls", "room", "door", "window", "paint", "roof", "rooftriangle", "roofside"]);
		this.ToolModes = new Enum(["none", "apply", "erase"]);
		this.FillModes = new Enum(["add", "ignore", "remove"]);
		this.PaintModes = new Enum(["walls", "floors", "bottoms"]);
		this.model = new Building();
		
		this.tileCursor = null;//tileCursor;

		this.settings = {
			"tool": this.Tools.pointer,
			"cursordisabled": false,
			"deletemode": false,
			"flooroptions": this.FillModes.add,
			"walloptions": this.FillModes.add,
			"paintoptions": this.PaintModes.walls,
			"selectedmaterial": 0,
			"selectedwindow": 0,
			"selectedroof": null,
			"renderBuilding": false,
			"wireframemode": false,
			"visualizephysics": false,
			"previewmode": false,
			"mouselookmode": false,
			"dragstart": null, //{x: null, y: null}
			"floorheight": 0,
			"defaultroofmaterial": 0,
			"defaultfloormaterial": 0,
			"defaultwallmaterial": 0,
			"defaultcielingmaterial": 0,
			"filterMode": 0 // 0 = none, 1 = walls, 2 = floors
		}

		this.toolActions = {};

		this.toolActions[this.Tools.pointer] = new this.Tool(
			"Mouse Look",
			() => {this.settings.mouselookmode = true}, 
			() => {}, 
			() => this.settings.mouselookmode = false
		);

		this.toolActions[this.Tools.tiles] = new this.Tool(
			"Floor", //Title
			(tpos) => { //Start action
				if(tpos){
					this.settings.dragstart = tpos;
					let tile = this.model.levels[this.mLevelCursor].tiles[tpos.y][tpos.x];
					this.settings.deletemode = tile.filled;
				}
			}, 
			(tpos) => { //Drag action
				this.setTileCursorPos(tpos, this.settings.dragstart);
				if(!this.settings.dragstart && tpos){
					let tile = this.model.levels[this.mLevelCursor].tiles[tpos.y][tpos.x];
					this.settings.deletemode = tile.filled;
				}
			}, 
			(tpos) => { //End action
				this.fillTileArea(tpos, false);
				this.settings.dragstart = null;
			}
		);

		this.toolActions[this.Tools.walls] = new this.Tool(
			"Wall",
			(tpos) => { //Start action
				this.settings.dragstart = tpos;
			}, 
			(tpos) => { //Drag action
				this.setTileCursorPos(tpos, this.settings.dragstart);
				if(this.settings.dragstart && tpos){
					let walls = this.getLinearWallsBetweenPts(this.settings.dragstart, tpos);
					if(walls.length > 0){
						let expand = false;
						for(let i = 0; i < walls.length; i++){
							let wall = walls[i];
							if(!wall.filled){
								expand = true;
								break;
							}
						}
						this.settings.deletemode = !expand;
					}
					else{
						this.settings.deletemode = false;
					}
				}
				else{
					this.settings.deletemode = false;
				}
			}, 
			(tpos) => { //End action
				if(tpos) {
					let walls = this.getLinearWallsBetweenPts(this.settings.dragstart, tpos);
					if(walls.length == 0) return this.settings.dragstart = null;
					let wall1 = walls[0];
					for(let i = 0; i < walls.length; i++){
						let wall = walls[i];
						this.settings.deletemode ? this.deleteWall(wall) : this.fillWall(wall);
					}
					Renderer.setWall(!this.settings.deletemode, this.mLevelCursor, wall1.label == "top" ? 1 : 2,
						walls[0].tile.x, walls[0].tile.y, walls[walls.length -1].tile.x, walls[walls.length -1].tile.y, 
						wall1.innerMaterialIndex, wall1.outerMaterialIndex);
				}
				this.settings.dragstart = null;
			}
		);

		this.toolActions[this.Tools.room] = new this.Tool(
			"Room",
			(tpos) => { //Start action
				this.settings.dragstart = tpos;
				this.settings.deletemode = false;
			}, 
			(tpos) => { //Drag action
				this.setTileCursorPos(tpos, this.settings.dragstart);
			}, 
			(tpos) => { //End action
				this.fillTileArea(tpos, true);
				this.settings.dragstart = null;
			}
		);

		this.toolActions[this.Tools.door] = new this.Tool(
			"Door",
			(tpos) => { //Start action
				//this.settings.dragstart = tpos;
			}, 
			(tpos) => { //Drag action
				this.setTileCursorPos(tpos, null);
			}, 
			(tpos) => { //End action
				if(tpos && !this.settings.cursordisabled) {
					let tile = this.model.levels[this.mLevelCursor].tiles[tpos.y][tpos.x];
					let wall = null;
					if(tpos.closestWall == "bottom") tile = tile.south, wall = tile.top;
					else if(tpos.closestWall == "right") tile = tile.east, wall = tile.left;
					else if(tpos.closestWall == "top") wall = tile.top;
					else if(tpos.closestWall == "left") wall = tile.left;
					wall.hasPortal = !wall.hasPortal;
					wall.windowIndex = -1;
					wall.undraw();
					Renderer.setDoor(wall.hasPortal, this.mLevelCursor, tpos.x, tpos.y, wall.label == "top");
				}
				//this.settings.dragstart = null;
			}
		);

		this.toolActions[this.Tools.window] = new this.Tool(
			"Window",
			(tpos) => { //Start action
				//this.settings.dragstart = tpos;
			}, 
			(tpos) => { //Drag action
				this.setTileCursorPos(tpos, null);
			}, 
			(tpos) => { //End action
				if(tpos && !this.settings.cursordisabled) {
					let tile = this.model.levels[this.mLevelCursor].tiles[tpos.y][tpos.x];
					let wall = null;
					if(tpos.closestWall == "bottom") tile = tile.south, wall = tile.top;
					else if(tpos.closestWall == "right") tile = tile.east, wall = tile.left;
					else if(tpos.closestWall == "top") wall = tile.top;
					else if(tpos.closestWall == "left") wall = tile.left;
					if(wall.windowIndex == -1) wall.windowIndex = 0;
					else wall.windowIndex = -1;
					wall.hasPortal = false;
					wall.undraw();
					//TODO: just draw this one tile instead of all of them.
					Renderer.setDoor(!this.settings.deletemode, this.mLevelCursor, x, y, wall.label == "top");
				}
				//this.settings.dragstart = null;
			}
		);

		this.toolActions[this.Tools.roof] = new this.Tool(
			"Roof", //Title
			(tpos) => { //Start action
				if(tpos){
					this.settings.dragstart = tpos;

				}
			}, 
			(tpos) => { //Drag/move action
				this.setTileCursorPos(tpos, this.settings.dragstart);
				if(!this.settings.dragstart && tpos){
					let tile = this.model.levels[this.mLevelCursor].tiles[tpos.y][tpos.x];
					this.settings.deletemode = tile.roof != null;
				}
			}, 
			(tpos) => { //End action
				let tile = this.model.levels[this.mLevelCursor].tiles[tpos.y][tpos.x];
				if(tile.roof){
					if(this.settings.deletemode){
						this.removeRoof(tpos);
					}
					else{
						//Might not need this.
						tile.roof._selected = true;
						this.settings.selectedroof = tile.roof;
					}
				}
				else{
					this.fillRoofArea(tpos);
				}
				this.settings.dragstart = null;
			}
		);

		/*this.toolActions[this.Tools.pointer] = new this.Tool(
			() => { //Start action
			}, 
			() => { //Drag action
			}, 
			() => { //End action
			}
		);*/

		//var tool = Tools.pointer;
		this.toolCursorX;
		this.toolCursorY;
		this.oldCursorX;
		this.oldCursorY;
		this.roomToolActive = false;

		this.mLevelCursor = 0;
	
		this.toolMode = this.ToolModes.none;
	}

	clearBuilding = function(){
		this.model = new Building();
		Renderer.clearBuilding();
	}

	addLevel = function(){
		this.model.addLevel();
		Renderer.addLevel();
	}
	
	fillTileArea = function(tpos, isRoom){
		if(tpos) {
			let startpos = this.settings.dragstart;
			let x1 = Math.min(tpos.x, startpos ? startpos.x : tpos.x);
			let y1 = Math.min(tpos.y, startpos ? startpos.y : tpos.y);
			let x2 = Math.max(tpos.x, startpos ? startpos.x : tpos.x);
			let y2 = Math.max(tpos.y, startpos ? startpos.y : tpos.y);
			this.model.levels[this.mLevelCursor].paintTiles(x1, y1, x2, y2, !this.settings.deletemode, this.settings.defaultfloormaterial.index, Tools3d.settings.defaultcielingmaterial.index, isRoom ? this.settings.defaultwallmaterial.index : -1 );
			Renderer.setFloor(!this.settings.deletemode, this.mLevelCursor, x1, y1, x2, y2, Tools3d.settings.defaultfloormaterial.index, Tools3d.settings.defaultcielingmaterial.index, isRoom ? this.settings.defaultwallmaterial.index : -1);
		}
	}
	
	fillRoofArea = function(tpos){
		if(tpos) {
			let startpos = this.settings.dragstart;
			let x1 = Math.min(tpos.x, startpos ? startpos.x : tpos.x);
			let y1 = Math.min(tpos.y, startpos ? startpos.y : tpos.y);
			let x2 = Math.max(tpos.x, startpos ? startpos.x : tpos.x);
			let y2 = Math.max(tpos.y, startpos ? startpos.y : tpos.y);
			let level = this.model.levels[this.mLevelCursor];
			level.addRoof(x1, y1, x2, y2, Tools3d.settings.defaultroofmaterial.index);

			Renderer.addRoof(this.mLevelCursor, x1, y1, x2, y2, Tools3d.settings.defaultroofmaterial.index);
		}
	}
	
	removeRoof = function(tpos){
		if(tpos) {
			let x = tpos.x;
			let y = tpos.y;
			let level = this.model.levels[this.mLevelCursor];
			level.removeRoof(x, y);

			Renderer.removeRoof(this.mLevelCursor, x, y);
		}
	}

	getLinearWallsBetweenPts(pt1, pt2){
		let ret = [];
		let tx, ty, sx, sy;
		tx = pt2.cx;
		ty = pt2.cy;
		sx = pt1 ? pt1.cx : tx;
		sy = pt1 ? pt1.cy : ty;
		let x1 = Math.min(tx, sx);
		let y1 = Math.min(ty, sy);
		let x2 = Math.max(tx, sx);
		let y2 = Math.max(ty, sy);
		let dx = x2 - x1
		let dy = y2 - y1;
		let vertical;
		if(Math.abs(dx) > Math.abs(dy)) {
			dy = 0;
			y1 = y2 = sy;
			vertical = false;
		}
		else {
			dx = 0;
			x1 = x2 = sx;
			vertical = true;
		}
		for(let i = 0; i < dx + dy; i++){
			let x = x1 + (vertical ? 0 : i);
			let y = y1 + (vertical ? i : 0);
			if(vertical && (y < 0 || y > TILES_H) || !vertical && (x < 0 || x > TILES_H)) break;
			let useOpposite = false;
			//if(vertical && (x == TILES_H)) useOpposite = true, x--;
			//if(!vertical && (y == TILES_H)) useOpposite = true, y--;
			let tile = this.model.levels[this.mLevelCursor].tiles[y][x];
			let wall = vertical ? (useOpposite ? tile.right : tile.left) : (useOpposite ? tile.bottom : tile.top);
			ret.push(wall);
		}
		return ret;
	}

	setTileCursorPos = function(tpos, startpos){
		let wallMode = {"walls":1, "door":1, "window":1}[Tools3d.settings.tool] ? true : false;
		let windowMode = Tools3d.settings.tool == "window";
		let roofMode = Tools3d.settings.tool == "roof";
		let wallModMode = {"door":1, "window":1}[Tools3d.settings.tool] ? true : false;
		let wt = this.model.tileSize + this.model.wallThickness;
		if(this.tileCursor && tpos && tpos.x >= 0 && tpos.y >= 0 && tpos.x <= TILES_H && tpos.y <= TILES_H){
			let N = TILES_H + 1;
			let s1 = -wt*(N+1) / 2;
			let tx, ty, sx, sy;
			if(wallMode){
				tx = tpos.cx;
				ty = tpos.cy;
				sx = startpos ? startpos.cx : tx;
				sy = startpos ? startpos.cy : ty;
			}
			else{
				tx = tpos.x;
				ty = tpos.y;
				sx = startpos ? startpos.x : tx;
				sy = startpos ? startpos.y : ty;
			}
			let x1 = Math.min(tx, sx);
			let y1 = Math.min(ty, sy);
			let x2 = Math.max(tx, sx);
			let y2 = Math.max(ty, sy);
			let dx = x2 - x1
			let dy = y2 - y1;
			let midx, midy;
			this.settings.cursordisabled = false;
			if(wallMode){
				if(wallModMode){
					midx = x1;
					midy = y1;

					this.tileCursor.scale.x = (tpos.closestWall == "top" || tpos.closestWall == "bottom") ? 0.8 : 0.2;
					this.tileCursor.scale.y = windowMode ? 12 : 20;
					this.tileCursor.scale.z = (tpos.closestWall == "top" || tpos.closestWall == "bottom") ? 0.2 : 0.8;
					this.tileCursor.position.y = (windowMode ? 1.65 : 1.0) + this.settings.floorheight;

					let tile = this.model.levels[this.mLevelCursor].tiles[tpos.y][tpos.x];
					let wall = null;
					if(tpos.closestWall == "bottom") tile = tile.south, wall = tile.top;
					else if(tpos.closestWall == "right") tile = tile.east, wall = tile.left;
					else if(tpos.closestWall == "top") wall = tile.top;
					else if(tpos.closestWall == "left") wall = tile.left;
					if(!wall.filled) this.settings.cursordisabled = true;
				}
				else{
					if(Math.abs(dx) > Math.abs(dy)) {
						dy = 0;
						midx = x1 + (dx) * 0.5;
						midy = sy;// + (dy) * 0.5;
					}
					else {
						dx = 0;
						midx = sx;// + (dx) * 0.5;
						midy = y1 + (dy) * 0.5;
					}
					this.tileCursor.scale.x = dx + 0.2;
					this.tileCursor.scale.y = 25;
					this.tileCursor.scale.z = dy + 0.2;
					this.tileCursor.position.y = 1.4 + this.settings.floorheight;
				}


			}
			else{
				midx = x1 + (dx + 1) * 0.5;
				midy = y1 + (dy + 1) * 0.5;

				if(roofMode){
					let tile = this.model.levels[this.mLevelCursor].tiles[tpos.y][tpos.x];
					if(tile.roof){
						dx = tile.roof.x2 - tile.roof.x1
						dy = tile.roof.y2 - tile.roof.y1;
						midx = tile.roof.x1 + (dx + 1) * 0.5;
						midy = tile.roof.y1 + (dy + 1) * 0.5;
					}

					let calcH = (Math.min(dx, dy) + 1) * wt * this.model.roofSlope + 0.15;
					this.tileCursor.scale.y = Math.min(calcH, this.model.roofHeight) / 0.11;// * this.model.roofSlope;
					this.tileCursor.scale.x = dx + 1.3;
					this.tileCursor.scale.z = dy + 1.3;

					this.tileCursor.position.y = this.tileCursor.scale.y * 0.5 * 0.11 + this.settings.floorheight;
				}
				else{
					this.tileCursor.scale.x = dx + 1;
					this.tileCursor.scale.y = 1;
					this.tileCursor.scale.z = dy + 1;

					this.tileCursor.position.y = 0 + this.settings.floorheight;
				}

			}
			if(wallModMode){
				this.tileCursor.position.x = s1 + tpos.wallCursorX * wt;
				this.tileCursor.position.z = s1 + tpos.wallCursorY * wt;
			}
			else{
				this.tileCursor.position.x = s1 + midx * wt;
				this.tileCursor.position.z = s1 + midy * wt;
			}
		}
	}

	changeSetting(toolName, value){
		this.settings[toolName] = value;
		$("." + toolName + "-radio").removeClass("radio-selected");
		$("#" + toolName + "-" + value + "-radio").addClass("radio-selected");
	
		//Special handling for certain settings.
		if(toolName == "tool"){
		
			$(".adv-options").hide();
			$("#" + value + "-adv-options").show();
		}
	}

	startInteraction(pt){
		let tpos = this.getTileFromPt(pt);
		this.toolActions[this.settings.tool].start(tpos);
		//console.log(Tools3d.settings.mouselookmode);
	}
	
	moveInteraction(pt){
		let tpos = this.getTileFromPt(pt);
		if(this.toolActions[this.settings.tool]) this.toolActions[this.settings.tool].move(tpos);
		else console.warn(`Tool action for ${this.settings.tool} not found.`);
	}
	
	completeInteraction(pt, geometry){
		let tpos = this.getTileFromPt(pt);
		this.toolActions[this.settings.tool].end(tpos);
		/*
		drawTile(this.model.levels[0].tiles[tpos.y][tpos.x]);
		//redrawTile(this.model.levels[0].tiles[tpos.y][tpos.x]);

		//console.log(geometry.attributes.position.needsUpdate);
		//console.log(geometry.index.needsUpdate);
		geometry.attributes.position.needsUpdate = true;
		//geometry.index.needsUpdate = true;
		//console.log(geometry.drawRange);
		//geometry.verticesNeedUpdate = true;
		//console.log(geometry.attributes.position.needsUpdate);
		//console.log(geometry.index.needsUpdate);
		*/
	}

	setWireframeMode(value){
		this.settings.wireframemode = value;
		Renderer.renderBuilding(false);
	}

	noFilter(){
		this.settings.filterMode = 0;
		this.tileCursor.material.transparent = true;
		Renderer.renderBuilding(false);
	}

	wallFilter(){
		this.settings.filterMode = 1;
		this.tileCursor.material.transparent = false;
		Renderer.renderBuilding(false);
	}

	floorFilter(){
		this.settings.filterMode = 2;
		this.tileCursor.material.transparent = false;
		Renderer.renderBuilding(false);
	}

	levelUp(){
		this.mLevelCursor++;
		if(this.mLevelCursor >= this.model.levels.length){
			this.addLevel();
		}
		this.settings.floorheight = this.model.levels[this.mLevelCursor]._gl;
		Renderer.renderLevel(this.mLevelCursor - 1);
		Renderer.renderLevel(this.mLevelCursor);
		/*if(this.settings.filterMode != 0) { // We can leverage this if we can figure out how to re-do the raycast colliders array in custom controls.
		}*/
	}

	levelDown(){
		if(this.mLevelCursor > 0) {
			this.mLevelCursor--;
			this.settings.floorheight = this.model.levels[this.mLevelCursor]._gl;
			Renderer.renderLevel(this.mLevelCursor + 1);
			Renderer.renderLevel(this.mLevelCursor);
			/*if(this.settings.filterMode != 0) {
			}*/
		}
	}

	loadFile(fileContent){
		try{
			this.model.loadJson(JSON.parse(fileContent));
			Renderer.loadFile(fileContent);
		}
		catch(e){
			console.error(e);
			alert("The default model could not be loaded. The file may be corrupt or out of date. Please report this issue.");
		}
	}

	getTileFromPt(pt){
		if(!pt) return null;
		let wt = 1.55;
		let N = TILES_H + 1;
		let o = -wt*(N+1) / 2;
		//let x2 = wt*(N-1) / 2;
		let xN = (pt.x - o) / wt;
		let yN = (pt.z - o) / wt;
		let xF = Math.floor(xN);
		let yF = Math.floor(yN);
		let xTile = Math.max(0, Math.min(TILES_H - 1, xF));
		let yTile = Math.max(0, Math.min(TILES_V - 1, yF));
		let xCorner = Math.min(TILES_H, Math.floor(xN + 0.5));
		let yCorner = Math.min(TILES_V, Math.floor(yN + 0.5));
		
		let closestWall = null;
		let dcx = xN - 0.5 - xF;
		let dcy = yN - 0.5 - yF;
		let wallCursorX = 0;
		let wallCursorY = 0;
		if(Math.abs(dcx) < Math.abs(dcy)){
			wallCursorX = xTile + 0.5;
			if(dcy < 0 || yCorner == 0){
				closestWall = "top";
				wallCursorY = yCorner;
			}
			else{
				closestWall = "bottom";
				wallCursorY = yCorner;
			}
		}
		else{
			wallCursorY = yTile + 0.5;
			if(dcx < 0 || xCorner == 0){
				closestWall = "left";
				wallCursorX = xCorner;
			}
			else{
				closestWall = "right";
				wallCursorX = xCorner;
			}
		}
	
		//console.log(yTile);
		//console.log(xTile + ", " + yTile);
		return {x: xTile, y: yTile, 
			cx: xCorner, cy: yCorner, 
			wallCursorX: wallCursorX, wallCursorY: wallCursorY,
			closestWall: closestWall
		};
	}
	
	deleteWall(wall){
		if(wall.filled){
			wall.windowIndex = -1;
			wall.hasPortal = false;
			wall.filled = false;
			wall.undraw();
		}
	}
	fillWall(wall){
		if(!wall.filled){
			wall.filled = true;
			wall.innerMaterialIndex = Tools3d.settings.defaultwallmaterial.index;
			wall.outerMaterialIndex = Tools3d.settings.defaultwallmaterial.index;
			wall.undraw();
		}
	}
	
	deleteTile(tile){tile.filled = false;}
	fillTile(tile){
		tile.filled = true;
		tile.floorMaterialIndex = Tools3d.settings.defaultfloormaterial.index;
		tile.bottomMaterialIndex = Tools3d.settings.defaultcielingmaterial.index;
	}

	exportToObj(){
		Renderer.exportToObj();
	}

	switchToFirstPerson(){
		Renderer.switchToFirstPerson();
	}

	switchToFlyingCamera(){
		Renderer.switchToFlyingCamera();
	}
});