"use strict";

var WALL_THICKNESS = 0.1;
var BASE_TILE_SIZE = 1.45;
var DEFAULT_ROOF_SLOPE = 0.5;
var DEFAULT_FLOOR_THICKNESS = 0.1;
var DEFAULT_LEVEL_HEIGHT = 3;
var DEFAULT_ROOF_HEIGHT = DEFAULT_LEVEL_HEIGHT + DEFAULT_FLOOR_THICKNESS - 0.002;
var TILE_PX = 14;
var WALL_PX = 0;

var TILES_H = 63;
var TILES_V = 63;

var getDefaultMaterial = function(){
	return 2;
}

class _BoxRegion{
	/**
	 * 
	 * @param {Tile} startTile The starting tile.
	 * @param {Tile} endTile The ending tile.
	 */
	constructor(startTile, endTile){
		this.startTile = startTile;
		this.endTile = endTile;
	}
}

class _BoxRegionCollections{
	constructor(){
		/**
		 * KVP for getting a _BoxRegion by material index.
		 */
		this.collections = {};
	}

	getCollection(numb){
		if(!this.collections[numb]){
			this.collections[numb] = [];
		}
		return this.collections[numb];
	}

	addBoxRegion(material, startTile, endTile){
		this.getCollection(material).push(new _BoxRegion(startTile, endTile));
	}

	clear(){
		this.collections = {};
	}

	getSize(material){
		return this.getCollection(material).length;
	}
}

class Roof{
	/**
	 * 
	 * @param {Level} level The level the roof is on.
	 * @param {Number} x1 West tile pos that the roof occupies.
	 * @param {Number} y1 North tile pos that the roof occupies.
	 * @param {Number} x2 East tile pos that the roof occupies.
	 * @param {Number} y2 South tile pos that the roof occupies.
	 */
	constructor(level, x1, y1, x2, y2){
		this.x1 = x1;
		this.y1 = y1;
		this.x2 = x2;
		this.y2 = y2;
		this.level = level;
		this.materialIndex = 0;
		for(let x = x1; x <= x2; x++){for(let y = y1; y <= y2; y++){
			let existing = this.level.tiles[y][x].roof;
			if(existing){
				existing.destroy();
			}
			this.level.tiles[y][x].roof = this;
		}}

		this._selected = false;
	}

	destroy(){
		for(let x = this.x1; x <= this.x2; x++){for(let y = this.y1; y <= this.y2; y++){
			this.level.tiles[y][x].roof = null;
		}}

		for(let i = 0; i < this.level.roofs.length; i++){
			if(this.level.roofs[i] == this){
				this.level.roofs.splice(i, 1);
				break;
			}
		}
	}
}

class WallWindow{
	constructor(){
		this.height = 1.3;
		this.width = 1.3;
		this.bottom = 1;
		this.style = "glass"; //Options are glass, bars, none - only none is supported.
	}
}

class Wall{
	/**
	 * 
	 * @param {Tile} tile Tile the wall is on.
	 * @param {String} label Label indicating wall orientation.
	 */
	constructor(tile, label){
		this.label = label;
		this.filled = false;
		this.hasTriangularRoofFace = false;
		this.hasRectangularRoofFace = false;
		//this.otherSide = null;
		this.tile = tile;
		this.hasPortal = false;
		this.windowIndex = -1;

		this.innerMaterialIndex = 0;
		this.outerMaterialIndex = 0;
		this.physicsMaterial = 0; // Don't touch this.
		
		//meta

		this._isource = null;
		this._osource = null;
		this._tsource = null;
		this._bsource = null;

		this.undraw();
	}

	undraw(){
		this._idrawn = false;
		this._odrawn = false;
		this._tdrawn = false;
		this._bdrawn = false;

		// Physics
		this._ipdrawn = false;
		this._opdrawn = false;
		this._tpdrawn = false;
		this._bpdrawn = false;
	}

	get otLabel(){
		switch(this.label){
			case "top": return "bottom";
			case "left": return "right";
		}
	}
	get adjt(){
		return this.label == "top" ? this.tile.north : this.tile.west;
	}
	get domMaterialIndex(){
		return Math.min(this.innerMaterialIndex, this.outerMaterialIndex);
	}
	get bottomMaterialIndex(){
		return (this.tile.filled && (!this.adjt || !this.adjt.filled)) ? this.tile.bottomMaterialIndex 
		: ( (!this.tile.filled && this.adjt && this.adjt.filled) ? this.adjt.bottomMaterialIndex 
		: this.domMaterialIndex);
	}

	get next(){
		switch(this.label){
			case "top": return this.tile.east ? this.tile.east.top : null;
			case "left": return this.tile.south ? this.tile.south.left : null;
		}
	}

	get prev(){
		switch(this.label){
			case "top": return this.tile.west ? this.tile.west.top : null;
			case "left": return this.north.south ? this.tile.north.left : null;
		}
	}

	get above(){
		if(!this.tile.above) return null;
		return this.tile.above[this.label];
	}
	
	get below(){
		if(!this.tile.below) return null;
		return this.tile.below[this.label];
	}

	paint(filled, iMaterial = -1, oMaterial = -1){
		this.filled = filled;
		if(filled){
			this.innerMaterialIndex = iMaterial;
			this.outerMaterialIndex = oMaterial;
		}
	}
}

class Tile{
	/**
	 * 
	 * @param {Level} l Level.
	 * @param {Number} x X pos.
	 * @param {Number} y Y pos.
	 * @param {Number} tl 
	 * @param {Number} tt 
	 */
	constructor(l, x, y, tl, tt){
		this.filled = false;
		this.roof = null;
		//this._hasRoof = false;

		//Coords (for reference;
		this.level = l;
		this.x = x;
		this.y = y;

		//Walls
		this.top = new Wall(this, "top");
		this.left = new Wall(this, "left");

		//Neighbours
		/** @type {Tile} */
		this.north = tt;
		/** @type {Tile} */
		this.west = tl;
		/** @type {Tile} */
		this.east = null;
		/** @type {Tile} */
		this.south = null;
		if(tt) {
			tt.south = this;
			//this.top.otherSide = tt.bottom;
			//tt.bottom.otherSide = this.top;
		}
		if(tl) {
			tl.east = this;
			//this.left.otherSide = tl.right;
			//tl.right.otherSide = this.left;
		}

		this.floorMaterialIndex = 0;
		this.bottomMaterialIndex = 0;
		this.physicsMaterial = 0; // Don't touch this.

		//meta
		this.undraw();
	}

	/*get hasRoof(){
		return this._hasRoof;
	}

	set hasRoof(value){
		this._hasRoof = value ? true : false;
		if(!this._hasRoof){
			
		}
	}*/

	get above(){
		let l = this.level.above;
		if(!l) return null;
		else return l.tiles[this.y][this.x];
	}

	get below(){
		let l = this.level.below;
		if(!l) return null;
		else return l.tiles[this.y][this.x];
	}

	undraw(){
		this._tpainted = false; // top
		this._bpainted = false; // bottom
		this._npainted = false; // north
		this._epainted = false; // east
		this._spainted = false; // south
		this._wpainted = false; // west
		
		this._tppainted = false; // top
		this._bppainted = false; // bottom
	}
}

class Level{
	/**
	 * 
	 * @param {Building} b 
	 */
	constructor(b){
		this.building = b;
		this.levelNumber = this.building.levels.length;
		var w = TILES_H + 1;
		var l = TILES_V + 1;
		/** @type {Tile[][]} */
		this.tiles = [];
		this.height = DEFAULT_LEVEL_HEIGHT;
		this.floorThickness  = DEFAULT_FLOOR_THICKNESS;
		/** @type {Roof[]} */
		this.roofs = [];
		/**
		 * Meta data for the list of protals to be drawn. Recalculated every draw.
		 * @type {Wall[]}
		 */
		this._portalWalls = [];

		// Cached level data for rendering.
		this._ch = b.levels.length > 0 ? b.levels[b.levels.length - 1]._cl : -this.floorThickness;
		this._gl = this._ch + this.floorThickness;
		this._cl = this._gl + this.height;

		for(var y = 0; y < l; y++){
			var row = [];
			for(var x = 0; x < w; x++){
				row.push(new Tile(this, x, y, x > 0 ? row[x - 1]: null, y > 0 ?  this.tiles[y - 1][x]: null));
			}
			this.tiles.push(row);
		}

		// Boxes
		// These represent tile ranges for optimized meshes.
		// For instance, a floor might extend over a square area.
		
		this._tileTopBoxes = new _BoxRegionCollections();
		this._tileBottomBoxes = new _BoxRegionCollections();
		this._tileNorthBoxes = new _BoxRegionCollections();
		this._tileEastBoxes = new _BoxRegionCollections();
		this._tileSouthBoxes = new _BoxRegionCollections();
		this._tileWestBoxes = new _BoxRegionCollections();

		//this._wallTopBoxes = new _BoxRegionCollections();
		//this._wallBottomBoxes = new _BoxRegionCollections();
		this._wallNorthBoxes = new _BoxRegionCollections();
		this._wallEastBoxes = new _BoxRegionCollections();
		this._wallSouthBoxes = new _BoxRegionCollections();
		this._wallWestBoxes = new _BoxRegionCollections();

		this._northWallEdgeBoxes = new _BoxRegionCollections();
		this._eastWallEdgeBoxes = new _BoxRegionCollections();
		this._southWallEdgeBoxes = new _BoxRegionCollections();
		this._westWallEdgeBoxes = new _BoxRegionCollections();

		this._wallTopHBoxes = new _BoxRegionCollections();
		this._wallTopVBoxes = new _BoxRegionCollections();
		this._wallBottomHBoxes = new _BoxRegionCollections();
		this._wallBottomVBoxes = new _BoxRegionCollections();

		// Physics.
		this._pTileTopBoxes = new _BoxRegionCollections();
		this._pTileBottomBoxes = new _BoxRegionCollections();
		this._pWallNorthBoxes = new _BoxRegionCollections();
		this._pWallEastBoxes = new _BoxRegionCollections();
		this._pWallSouthBoxes = new _BoxRegionCollections();
		this._pWallWestBoxes = new _BoxRegionCollections();
	}

	get above(){
		return this.building.levels[this.levelNumber + 1] || null;
	}

	get below(){
		return this.building.levels[this.levelNumber - 1] || null;
	}

	// Commands: 

	paintTiles(x1, y1, x2, y2, fill, tMaterial, bMaterial, wMaterial){
		for(let y = y1; y <= y2; y++){
			for(let x = x1; x <= x2; x++){
				let tile = this.tiles[y][x];
				if(fill){
					tile.filled = true;
					tile.floorMaterialIndex = tMaterial;
					tile.bottomMaterialIndex = bMaterial;
				}
				else{
					tile.filled = false;
				}
				if(wMaterial != -1){
					tile.top.paint(y == y1, wMaterial, wMaterial);
					tile.left.paint(x == x1, wMaterial, wMaterial);
					if(y == y2) tile.south.top.paint(true, wMaterial, wMaterial);
					if(x == x2) tile.east.left.paint(true, wMaterial, wMaterial);
				}
			}
		}
	}

	paintWalls(wallMode, x1, y1, x2, y2, fill, iMaterial, oMaterial){
		if(wallMode == 1 || wallMode == 2){
			if(x2 - x1 != 0 && y2 - y1 != 0) throw "Normal walls must be drawn along x or y.";
			for(let y = y1; y <= y2; y++){
				for(let x = x1; x <= x2; x++){
					let tile = this.tiles[y][x];
					let wall = wallMode == 1 ? tile.top : tile.left;
					if(fill){
						wall.filled = true;
						wall.innerMaterialIndex = iMaterial;
						wall.outerMaterialIndex = oMaterial;
					}
					else{
						wall.filled = false;
					}
				}
			}
		}
		else{
			//Diagonal wall support goes here.
			if(x2 - x1 != y2 - y1) throw "Diagonal walls must be drawn on squares.";
			throw "Diagonal walls not supported yet."
		}
	}

	addRoof(x1, y1, x2, y2, material){
		let roof = new Roof(this, x1, y1, x2, y2);
		roof.materialIndex = material;
		this.roofs.push(roof);
	}

	removeRoof(x, y){
		let found = null;
		for(let r in this.roofs){
			let roof = this.roofs[r];
			if(x >= roof.x1 && x <= roof.x2 && y >= roof.y1 && y <= roof.y2){
				found = roof;
				break;
			}
		}
		if(found){
			found.destroy();
		}
	}

	floodPaintTile(surface, x, y, material){}

	floodPaintWall(surface, x, y, material){}

	// Render helpers:

	updateBoxes(exportMode){

		// Tiles.
		this._tileTopBoxes.clear();
		this._tileBottomBoxes.clear();
		this._tileNorthBoxes.clear();
		this._tileEastBoxes.clear();
		this._tileSouthBoxes.clear();
		this._tileWestBoxes.clear();

		// Walls.
		this._wallNorthBoxes.clear();
		this._wallEastBoxes.clear();
		this._wallSouthBoxes.clear();
		this._wallWestBoxes.clear();

		this._northWallEdgeBoxes.clear();
		this._eastWallEdgeBoxes.clear();
		this._southWallEdgeBoxes.clear();
		this._westWallEdgeBoxes.clear();

		this._wallTopHBoxes.clear();
		this._wallTopVBoxes.clear();
		this._wallBottomHBoxes.clear();
		this._wallBottomVBoxes.clear();

		// Physics
		this._pTileTopBoxes.clear();
		this._pTileBottomBoxes.clear();
		this._pWallNorthBoxes.clear();
		this._pWallEastBoxes.clear();
		this._pWallSouthBoxes.clear();
		this._pWallWestBoxes.clear();


		this._portalWalls = [];

		for(let y = 0; y < TILES_H + 1; y++){
			for(let x = 0; x < TILES_H + 1; x++){
				let tile = this.tiles[y][x];
				if(tile.left && tile.left.filled && tile.left.hasPortal) this._portalWalls.push(tile.left);
				if(tile.top && tile.top.filled && tile.top.hasPortal) this._portalWalls.push(tile.top);

				//this.renderTileBoxes(x, y, "_ppainted", null, "_tileTopBoxes");
				this.renderTileBoxes(x, y, "_tpainted", "floorMaterialIndex", "_tileTopBoxes");
				this.renderTileBoxes(x, y, "_bpainted", "bottomMaterialIndex", "_tileBottomBoxes");
				
				this.renderTileEdgeBoxes(x, y, "_npainted", "floorMaterialIndex", "_tileNorthBoxes");
				this.renderTileEdgeBoxes(x, y, "_epainted", "floorMaterialIndex", "_tileEastBoxes");
				this.renderTileEdgeBoxes(x, y, "_spainted", "floorMaterialIndex", "_tileSouthBoxes");
				this.renderTileEdgeBoxes(x, y, "_wpainted", "floorMaterialIndex", "_tileWestBoxes");

				this.renderWallBoxes(x, y, "_idrawn", "innerMaterialIndex", "_wallNorthBoxes");
				this.renderWallBoxes(x, y, "_odrawn", "outerMaterialIndex", "_wallSouthBoxes");
				this.renderWallBoxes(x, y, "_idrawn", "innerMaterialIndex", "_wallEastBoxes");
				this.renderWallBoxes(x, y, "_odrawn", "outerMaterialIndex", "_wallWestBoxes");

				this.renderWallEdgeBoxes(x, y);

				this.renderWallTopAndBottomBoxes(x, y, "_tdrawn", "_wallTopHBoxes", exportMode);
				this.renderWallTopAndBottomBoxes(x, y, "_bdrawn", "_wallBottomHBoxes", exportMode);
				this.renderWallTopAndBottomBoxes(x, y, "_tdrawn", "_wallTopVBoxes", exportMode);
				this.renderWallTopAndBottomBoxes(x, y, "_bdrawn", "_wallBottomVBoxes", exportMode);

				// Physics.
				this.renderTileBoxes(x, y, "_tppainted", "physicsMaterial", "_pTileTopBoxes");
				this.renderTileBoxes(x, y, "_bppainted", "physicsMaterial", "_pTileBottomBoxes");
				this.renderWallBoxes(x, y, "_ipdrawn", "physicsMaterial", "_pWallNorthBoxes");
				this.renderWallBoxes(x, y, "_opdrawn", "physicsMaterial", "_pWallSouthBoxes");
				this.renderWallBoxes(x, y, "_ipdrawn", "physicsMaterial", "_pWallEastBoxes");
				this.renderWallBoxes(x, y, "_opdrawn", "physicsMaterial", "_pWallWestBoxes");

				// Undraw this tile, since we will not be revisiting it.
				this.building.levels[this.levelNumber].tiles[y][x].undraw();
				this.building.levels[this.levelNumber].tiles[y][x].left.undraw();
				this.building.levels[this.levelNumber].tiles[y][x].top.undraw();
			}
		}
		//console.log(this._tileTopBoxes.getSize(2));
	}

	renderTileBoxes(x, y, metaTag, materialIndexName, boxGroupName){
		let tile1 = this.tiles[y][x];
		let tile2 = tile1;
		//if(!tile1) console.log("!tile1");
		//if(tile1[metaTag]) console.log("tile1[metaTag]");
		if(!tile1 || !tile1.filled || tile1[metaTag]) return;
		let tile1MaterialIndex = materialIndexName ? tile1[materialIndexName] : -1;
		//console.log("filled");

		let maxX = x;
		let maxY = y;
		for(let xe = x; xe < TILES_H + 1; xe++){
			let obstructed = false;
			for(let ye = y; (xe == x && ye < TILES_H + 1) || (ye <= maxY); ye++){
				let tile = this.tiles[ye][xe];
				if(tile && tile.filled && !tile[metaTag] && (tile1MaterialIndex == -1 || tile[materialIndexName] == tile1MaterialIndex)){
					// let tile2 = tile1;
					maxY = Math.max(maxY, ye);
				}
				else{
					if(xe != x) obstructed = true;
					break;
				}
			}
			if(obstructed) break;
			else {
				maxX = Math.max(maxX, xe);
				tile2 = this.tiles[maxY][xe];
			}
		}

		// Paint everything using the meta tag to indicate it's been serviced.
		for(let ye = y; ye <= maxY; ye++){
			for(let xe = x; xe <= maxX; xe++){
				//if(tile && tile.filled && !tile[metaTag]){
				this.tiles[ye][xe][metaTag] = true;
				//}
			}
		}
		this[boxGroupName].addBoxRegion(tile1MaterialIndex, tile1, tile2);
	}
	
	renderTileEdgeBoxes(x, y, metaTag, materialIndexName, boxGroupName){
		let tile1 = this.tiles[y][x];
		let tile2 = tile1;
		if(!tile1 || !tile1.filled || tile1[metaTag]) return;
		if(metaTag == "_npainted" && y != 0 && tile1.north && tile1.north.filled) return;
		if(metaTag == "_spainted" && y != 63 && tile1.south && tile1.south.filled) return;
		if(metaTag == "_epainted" && x != 63 && tile1.east && tile1.east.filled) return;
		if(metaTag == "_wpainted" && x != 0 && tile1.west && tile1.west.filled) return;
		let tile1MaterialIndex = tile1[materialIndexName];
		
		if(metaTag == "_npainted" || metaTag == "_spainted"){
			// East to west.
			for(let xe = x; xe < TILES_H + 1; xe++){
				let tile = this.tiles[y][xe];
				if(!tile || !tile.filled || tile[metaTag] || tile[materialIndexName] != tile1MaterialIndex) break;
				if(metaTag == "_npainted" && y != 0 && tile.north && tile.north.filled) break;
				if(metaTag == "_spainted" && y != 63 && tile.south && tile.south.filled) break;
				tile[metaTag] = true;
				tile2 = tile;
				
			}
		}
		if(metaTag == "_epainted" || metaTag == "_wpainted"){
			// East to west.
			for(let ye = y; ye < TILES_H + 1; ye++){
				let tile = this.tiles[ye][x];
				if(!tile || !tile.filled || tile[metaTag] || tile[materialIndexName] != tile1MaterialIndex) break;
				if(metaTag == "_epainted" && x != 63 && tile.east && tile.east.filled) break;
				if(metaTag == "_wpainted" && x != 0 && tile.west && tile.west.filled) break;
				tile[metaTag] = true;
				tile2 = tile;
				
			}
		}
		this[boxGroupName].addBoxRegion(tile1MaterialIndex, tile1, tile2);
	}
	
	renderWallBoxes(x, y, metaTag, materialIndexName, boxGroupName){
		let tile1 = this.tiles[y][x];
		let wall1;
		
		switch(boxGroupName){
			case "_wallNorthBoxes": case "_wallSouthBoxes": case "_pWallNorthBoxes": case "_pWallSouthBoxes": {
				wall1 = tile1.top
				break;
			}
			default: {
				wall1 = tile1.left
				break;
			}
		}

		let next = wall1;
		let tile2 = tile1;
		if(!wall1 || !wall1.filled || wall1[metaTag]) return;

		let wall1MaterialIndex = wall1[materialIndexName];
		wall1[metaTag] = true;
		next = !wall1.hasPortal ? next.next : null;
		
		while(next && next.filled && !next[metaTag] && next[materialIndexName] == wall1MaterialIndex && !next.hasPortal){
			next[metaTag] = true;
			tile2 = next.tile;
			next = next.next;
		}
		
		
		this[boxGroupName].addBoxRegion(wall1MaterialIndex, tile1, tile2);
	}
	
	renderWallEdgeBoxes(x, y){
		let tile = this.tiles[y][x];

		// Top wall.
		if(tile.top && tile.top.filled){
			// Left edge.
			if((!tile.left || !tile.left.filled) 
			&& (!tile.west || !tile.west.top || !tile.west.top.filled) 
			&& (!tile.north || !tile.north.left || !tile.north.left.filled)){
				this._westWallEdgeBoxes.addBoxRegion(Math.min(tile.top.innerMaterialIndex, tile.top.outerMaterialIndex), tile, tile);
			}

			// Right edge.
			if((!tile.east || !tile.east.left || !tile.east.left.filled) 
			&& (!tile.east || !tile.east.top || !tile.east.top.filled) 
			&& (!tile.east || !tile.east.north || !tile.east.north.left || !tile.east.north.left.filled)){
				this._eastWallEdgeBoxes.addBoxRegion(Math.min(tile.top.innerMaterialIndex, tile.top.outerMaterialIndex), tile, tile);
			}
		}

		// Left wall.
		if(tile.left && tile.left.filled){
			// North edge.
			if((!tile.top || !tile.top.filled) 
			&& (!tile.north || !tile.north.left || !tile.north.left.filled)
			&& (!tile.west || !tile.west.top || !tile.west.top.filled)){
				this._northWallEdgeBoxes.addBoxRegion(Math.min(tile.left.innerMaterialIndex, tile.left.outerMaterialIndex), tile, tile);
			}

			// South edge.
			if((!tile.south || !tile.south.top || !tile.south.top.filled) 
			&& (!tile.south || !tile.south.left || !tile.south.left.filled) 
			&& (!tile.south || !tile.south.west || !tile.south.west.top || !tile.south.west.top.filled)){
				this._southWallEdgeBoxes.addBoxRegion(Math.min(tile.left.innerMaterialIndex, tile.left.outerMaterialIndex), tile, tile);
			}
		}
	}

	renderWallTopAndBottomBoxes(x, y, metaTag, boxGroupName, exportMode){
		let tile1 = this.tiles[y][x];
		if(!tile1) return;
		let wall1 = boxGroupName == "_wallTopHBoxes" || boxGroupName == "_wallBottomHBoxes" ? tile1.top : tile1.left;
		if(this.validateMetaTagForWall(wall1, metaTag, boxGroupName, exportMode)){
			let material = wall1.innerMaterialIndex == wall1.outerMaterialIndex ? wall1.innerMaterialIndex : getDefaultMaterial();
			
			let wall2 = wall1;
			let next = wall1;
			next[metaTag] = true;
			do{
				next = next.next;
				if(!this.validateMetaTagForWall(next, metaTag, boxGroupName, exportMode)) break;
				let material2 = next.innerMaterialIndex == next.outerMaterialIndex ? next.innerMaterialIndex : getDefaultMaterial();
				if(material2 != material) {
					console.log("Wrong material.");
					break;
				}
				// TODO: include some special logic to handle walls that are on top of or below floors, to prevent z fighting.
				next[metaTag] = true;
				wall2 = next;
			}while(true);
			

			this[boxGroupName].addBoxRegion(material, tile1, wall2.tile);
		}
	}

	/**
	 * 
	 * @param {Wall} wall 
	 * @param {string} metaTag 
	 * @param {string} boxGroupName 
	 * @param {boolean} exportMode 
	 */
	validateMetaTagForWall(wall, metaTag, boxGroupName, exportMode){
		if(wall && wall.filled && !wall[metaTag]){
			// if(!exportMode) return true;
			// else
			{
				if(boxGroupName == "_wallTopHBoxes" || boxGroupName == "_wallTopVBoxes"){
					if(!wall.above || !wall.above.filled) return true;
				}
				else if(boxGroupName == "_wallBottomHBoxes" || boxGroupName == "_wallBottomVBoxes"){
					if(!wall.below || !wall.below.filled) return true;
				}
				else{
					throw "Box group name " + boxGroupName + " not supported.";
				}
			}
		}
		return false;
	}
	
}


var b64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

class Building{
	constructor(){
		this.version = "1";
		this.w = TILES_H + 1;
		this.h = TILES_V + 1;
		this.tileSize = BASE_TILE_SIZE;
		this.wallThickness = WALL_THICKNESS;
		/**
		 * @type {Level[]}
		 */
		this.levels = [];
		this.myWindows = [];
		this.materials = [];
		this.filename = "";
		this.uniqueId = (new Date()).getTime() + "-" + ("" + Math.random()).substring(2);
		this.roofHeight = DEFAULT_ROOF_HEIGHT;
		this.roofSlope = DEFAULT_ROOF_SLOPE;
		//this.levels.push(new Level(this.w, this.h));
	}

	addLevel(){
		this.levels.push(new Level(this));
	}

	updateLevelHeights(){

		this.levels.forEach((level, i) => {
			level._ch = i > 0 ? this.levels[i - 1]._cl : -level.floorThickness;
			level._gl = level._ch + level.floorThickness;
			level._cl = level._gl + level.height;
		});
	}

	iterateTiles(callback){
		for(var l = 0; l < this.levels.length; l++){
			var level = this.levels[l];
			for(var y = 0; y < level.tiles.length; y++){
				var row = level.tiles[y];
				for(var x = 0; x < row.length; x++){
					callback(l, x, y, row[x]);
				}
			}
		}
	}
	undraw(){
		throw "No longer supported.";
		this.iterateTiles(function(l, x, y, t){
			t.undraw();
			t.top.undraw();
			t.left.undraw();
			
			// t._flsource = null;
			// t._bsource = null;
			// t._tesource = null;
			// t._resource = null;
			// t._lesource = null;
			// t._besource = null;
			// t.top._isource = null;
			// t.left._isource = null;
			// t.top._osource = null;
			// t.left._osource = null;
			// t.top._tsource = null;
			// t.left._tsource = null;
			// t.top._bsource = null;
			// t.left._bsource = null;
			
			// t._flchildren = [];
			// t._bchildren = [];
			// t._techildren = [];
			// t._rechildren = [];
			// t._lechildren = [];
			// t._bechildren = [];
			// t.top._ichildren = [];
			// t.left._ichildren = [];
			// t.top._ochildren = [];
			// t.left._ochildren = [];
			// t.top._tchildren = [];
			// t.left._tchildren = [];
			// t.top._bchildren = [];
			// t.left._bchildren = [];
			
			// t._flfaces = [];
			// t._bfaces = [];
			// t._tefaces = [];
			// t._refaces = [];
			// t._lefaces = [];
			// t._befaces = [];
			// t.top._ifaces = [];
			// t.left._ifaces = [];
			// t.top._ofaces = [];
			// t.left._ofaces = [];
			// t.top._tfaces = [];
			// t.left._tfaces = [];
			// t.top._bfaces = [];
			// t.left._bfaces = [];
		});

		this.levels.forEach(l => {
			l.roofs.forEach(r => {
				r._selected = false;
			});
		});
	}
	/*addMaterial(material){
		material.index = this.materials.length;
		this.materials.push(material);
		return this.materials.length - 1; //The index of the new material.
	}*/

	updateBoxes(exportMode){
		this.levels.forEach(l => {
			l.updateBoxes(exportMode);
		});
	}

	removeMaterial(index){
		this.iterateTiles(function(l, x, y, tile){
			if(tile.floorMaterialIndex == index) tile.floorMaterialIndex = 0;
			if(tile.floorMaterialIndex > index) tile.floorMaterialIndex--;
			if(tile.bottomMaterialIndex == index) tile.bottomMaterialIndex = 0;
			if(tile.bottomMaterialIndex > index) tile.bottomMaterialIndex--;
			if(tile.top.innerMaterialIndex == index) tile.top.innerMaterialIndex = 0;
			if(tile.top.innerMaterialIndex > index) tile.top.innerMaterialIndex--;
			if(tile.left.outerMaterialIndex == index) tile.left.outerMaterialIndex = 0;
			if(tile.left.outerMaterialIndex > index) tile.left.outerMaterialIndex--;
		});
	
		this.materials.splice(index, 1);
		for(var i = index; i < this.materials.length; i++){
			this.materials[i].index = i;
		}
	}
	addWindow(wallWindow){
		wallWindow.index = this.myWindows.length;
		this.myWindows.push(wallWindow);
		return this.myWindows.length - 1;
	}
	removeWindow(index){
		this.iterateTiles(function(l, x, y, tile){
			if(tile.top.windowIndex == index) tile.top.windowIndex = -1;
			if(tile.left.windowIndex == index) tile.left.windowIndex = -1;
		});
	
		this.myWindows.splice(index, 1);
		/*for(var i = index; i < this.myWindows.length; i++){
			this.myWindows[i].index = i;
		}*/
	}
	toJson(){
		let ret = {};
		ret.name = this.filename;
		ret.uniqueId = this.uniqueId;
		ret.version = this.version;
		ret.tileSize = this.tileSize;
		ret.wallThickness = this.wallThickness;
		ret.levels = [];
		ret.win = [];
		for(let w = 0; w < this.myWindows.length; w++){
			let ww = this.myWindows[w];
			ret.win.push({"w": ww.width, "h": ww.height, "b": ww.bottom, "hi": "", "vi": ""});
		}
		for(let l = 0; l < this.levels.length; l++){
			//format for floors, vwalls, and hwalls:
			//5 b64 chars: [innertexture][outertexture][Y][X_start][X_finish]
			//except for vwalls: [innertexture][outertexture][X][Y_start][Y_finish]
			let level = this.levels[l];
			let hwalls = "";
			let vwalls = "";
			let tiles = "";
			/*let hwallsb = 0;
			let vwallsb = 0;
			let tilesb = 0;*/
			let vdoors = "";
			let hdoors = "";
			let roofs = [];

			//let i = 1;
			for(let y = 0; y < level.tiles.length; y++){
				let row = level.tiles[y];
				let tFlag = false;
				let tIIndex = 0;
				let tOIndex = 0;
				let vwFlag = false;
				let vwIIndex = 0;
				let vwOIndex = 0;
				let hwFlag = false;
				let hwIIndex = 0;
				let hwOIndex = 0;
	
				for(let x = 0; x < row.length; x++){
					let tile = row[x];
					if(!tFlag && tile.filled){
						tFlag = true;
						tIIndex = tile.floorMaterialIndex;
						tOIndex = tile.bottomMaterialIndex;
						tiles += b64[tIIndex] + b64[tOIndex] + b64[y] + b64[x];
					}
					if(tFlag && (!tile.east || !tile.east.filled || tile.east.floorMaterialIndex != tIIndex || tile.east.bottomMaterialIndex != tOIndex)){
						tiles += b64[x];
						tFlag = false;
					}
					if(!hwFlag && tile.top.filled){
						hwFlag = true;
						hwIIndex = tile.top.innerMaterialIndex;
						hwOIndex = tile.top.outerMaterialIndex;
						hwalls += b64[hwIIndex] + b64[hwOIndex] + b64[y] + b64[x];
					}
					if(hwFlag && (!tile.east || !tile.east.top.filled || tile.east.top.innerMaterialIndex != hwIIndex || tile.east.top.outerMaterialIndex != hwOIndex)){
						hwalls += b64[x];
						hwFlag = false;
					}
					//vwalls are a little different. We now switch x and y for efficiency purposes.
					let altTile = level.tiles[x][y];
					if(!vwFlag && altTile.left.filled){
						vwFlag = true;
						vwIIndex = altTile.left.innerMaterialIndex;
						vwOIndex = altTile.left.outerMaterialIndex;
						vwalls += b64[vwIIndex] + b64[vwOIndex] + b64[y] + b64[x];
					}
					if(vwFlag && (!altTile.south || !altTile.south.left.filled || altTile.south.left.innerMaterialIndex != vwIIndex || altTile.south.left.outerMaterialIndex != vwOIndex)){
						vwalls += b64[x];
						vwFlag = false;
					}
					/*tilesb += tile.filled ? i : 0;
					hwallsb += tile.top.filled ? i : 0;
					vwallsb += tile.left.filled ? i : 0;*/
					if(tile.left.hasPortal) vdoors += b64[x] + b64[y]
					if(tile.top.hasPortal) hdoors += b64[x] + b64[y]
					if(tile.left.windowIndex != -1) ret.myWindows[tile.left.windowIndex].vi += b64[l] + b64[x] + b64[y];
					if(tile.top.windowIndex != -1) ret.myWindows[tile.top.windowIndex].hi += b64[l] + b64[x] + b64[y];
					/*i <<= 1;
					if(i == 0b1000000){
						hwalls += b64[hwallsb];
						vwalls += b64[vwallsb];
						tiles += b64[tilesb];
						tilesb = 0;
						hwallsb = 0;
						vwallsb = 0;
						i = 1;
					}*/
				}
			}

			level.roofs.forEach(r => {
				roofs.push([r.materialIndex, r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1]);
			});
			
			ret.levels.push({
				ft: level.floorThickness,
				lh: level.height,
				hw: hwalls,
				vw: vwalls,
				t: tiles,
				vd: vdoors,
				hd: hdoors,
				rf: roofs
			});
		}
		return ret;
	}
	loadJson(val){
		//this.version = val.version;
		this.filename = val.filename;
		//console.log(val);
		this.uniqueId = val.uniqueId || this.uniqueId;
		this.tileSize = val.tileSize || this.tileSize;
		this.wallThickness = val.wallThickness || this.wallThickness;
		this.levels = [];
		this.myWindows = [];
		for(let l = 0; l < val.levels.length; l++){
			let vallevel = val.levels[l];
			let level = new Level(this);
			this.levels.push(level);
			level.height = vallevel.lh || level.height;
			level.floorThickness = vallevel.ft || level.floorThickness;
			
			let saveditem = vallevel.t;
			for(let i = 0; i < saveditem.length; i+=5){
				let s = saveditem.substring(i, i + 5);
				let it = b64.indexOf(s[0]);
				let ot = b64.indexOf(s[1]);
				let y = b64.indexOf(s[2]);
				let x1 = b64.indexOf(s[3]);
				let x2 = b64.indexOf(s[4]);
				for(let x = x1; x <= x2; x++){
					let t = level.tiles[y][x];
					t.filled = true;
					t.floorMaterialIndex = it;
					t.bottomMaterialIndex = ot;
				}
			} 
			
			saveditem = vallevel.hw;
			for(let i = 0; i < saveditem.length; i+=5){
				let s = saveditem.substring(i, i + 5);
				let it = b64.indexOf(s[0]);
				let ot = b64.indexOf(s[1]);
				let y = b64.indexOf(s[2]);
				let x1 = b64.indexOf(s[3]);
				let x2 = b64.indexOf(s[4]);
				for(let x = x1; x <= x2; x++){
					let t = level.tiles[y][x];
					t.top.filled = true;
					t.top.innerMaterialIndex = it;
					t.top.outerMaterialIndex = ot;
				}
			} 
			
			saveditem = vallevel.vw;
			//console.log("level " + l);
			for(let i = 0; i < saveditem.length; i+=5){
				let s = saveditem.substring(i, i + 5);
				let it = b64.indexOf(s[0]);
				let ot = b64.indexOf(s[1]);
				let x = b64.indexOf(s[2]);
				let y1 = b64.indexOf(s[3]);
				let y2 = b64.indexOf(s[4]);
				/*console.log(s);
				console.log(x);
				console.log(y1);
				console.log(y2);*/
				for(let y = y1; y <= y2; y++){
					let t = level.tiles[y][x];
					t.left.filled = true;
					t.left.innerMaterialIndex = it;
					t.left.outerMaterialIndex = ot;
				}
			}
	
			for(let i = 0; i < vallevel.hd.length; i += 2){
				let x = b64.indexOf(vallevel.hd[i]);
				let y = b64.indexOf(vallevel.hd[i + 1]);
				level.tiles[y][x].top.hasPortal = true;
			}
	
			for(let i = 0; i < vallevel.vd.length; i += 2){
				let x = b64.indexOf(vallevel.vd[i]);
				let y = b64.indexOf(vallevel.vd[i + 1]);
				level.tiles[y][x].left.hasPortal = true;
			}

			if(vallevel.rf){
				vallevel.rf.forEach(r => {
					let roof = new Roof(level, r[1], r[2], r[1] + r[3], r[2] + r[4]);
					roof.materialIndex = r[0];
					level.roofs.push(roof);
				});
			}
		}

		//Legacy TODO: remove before deployment.
		if(!val.win && val.myWindows) val.win = val.myWindows;

		for(let w = 0; val.win && w < val.win.length; w++){
			let ww = val.win[w];
			let nw = new WallWindow();
			nw.width = ww.w;
			nw.height = ww.h;
			nw.bottom = ww.b;
			this.addWindow(nw);
			for(let i = 0; i < ww.hi.length; i += 3){
				let s = ww.hi.substring(i, i + 3);
				let l = b64.indexOf(s[0]);
				let x = b64.indexOf(s[1]);
				let y = b64.indexOf(s[2]);
				this.levels[l].tiles[y][x].top.windowIndex = w;
			}
			for(let i = 0; i < ww.vi.length; i += 3){
				let s = ww.vi.substring(i, i + 3);
				let l = b64.indexOf(s[0]);
				let x = b64.indexOf(s[1]);
				let y = b64.indexOf(s[2]);
				this.levels[l].tiles[y][x].left.windowIndex = w;
			}
		}
	}
	save(){
		this.filename = this.filename || "building";
		if (typeof(Storage) !== "undefined") {
			// Code for localStorage/sessionStorage.
			let sjson = JSON.stringify(this.toJson());
			localStorage.setItem(this.uniqueId, sjson);
			
			let saves = localStorage.getItem("_mazebuildersaves")
			if(saves) saves = JSON.parse(saves);
			else saves = {"files": []};
			saves.default = this.uniqueId; //This need not be here, but I guess it doesn't hurt. Set it on load / new.
			let existingFile = saves.files.find((f) => {return f.uniqueId == this.uniqueId});
			if(existingFile){
				existingFile.size = sjson.length;
				existingFile.name = this.filename;
			}
			else{
				saves.files.push({"name": this.filename, "size": sjson.length, "uniqueId": this.uniqueId});
			}
			localStorage.setItem("_mazebuildersaves", JSON.stringify(saves));
			
		} else {
			this.download(this.filename);
		}
	}
	download(name){
		this.filename = name || this.filename || "building";
		let sjson = JSON.stringify(this.toJson());
		download(this.filename + ".txt", sjson);
	
	}
}