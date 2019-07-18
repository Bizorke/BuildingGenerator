"use scrict";

/**
 * A note on conventions.
 * 
 * POSTING MESSAGES
 * Messages should be sent as arrays. The first element in the array will be the command name, and the rest will be the arguments for the command.
 * 
 * GEOMETRY GROUPS (EDIT MODE)
 * Group 0: Transparent material.
 * Group 1: Wireframe material.
 * Group 2: Physics mesh.
 * Group 3+: Material groups.
 * 
 * GEOMETRY GROUPS (EXPORT MODE)
 * Group 0: Physics mesh.
 * Group 1+: Material groups.
 * 
 * EDIT MODE
 * In edit mode, each level will be its own Three object with it's own set of walls, floors, and roofs, each of which will have its own set of groups.
 * 
 * EXPORT MODE
 * In export mode, it will be one group per texture. No wireframe or transparent textures. Group zero will be for physics.
 */

importScripts('./lib/Sequencr.js');
importScripts('./Building.js');

/**
 * Represents a level. Or in export mode, represents the whole building.
 */
class RenderSegment{
	/**
	 * 
	 * @param {Number} level The level for this render segment. If -1, export mode (render all).
	 */
	constructor(level){
		this.level = level;
		this.exportMode = level == -1;
		
		this.materialGroupsCount = 0;
		if(this.exportMode){
			this.all = new RenderComponent(this.level, "all"); // Export mode.
		}
		else{
			this.floors = new RenderComponent(this.level, "floors"); // Edit mode.
			this.walls = new RenderComponent(this.level, "walls"); // Edit mode.
			this.roofs = new RenderComponent(this.level, "roofs"); // Edit mode.
		}
		this.physics = new RenderComponent(this.level, "physics"); // Both modes.
	}

	get components(){
		if(this.exportMode){
			return [
				this.all,
				this.physics
			];
		}
		else{
			return [
				this.floors,
				this.walls,
				this.roofs,
				this.physics
			];
		}
	}

	render(model){
		for(let c in this.components){
			this.components[c].render(model);
		}
	}

	addGroup(){
		this.components.forEach(c => {
			if(c.componentType != "physics") c.addGroup();
		});
		this.materialGroupsCount++;
	}

	removeGroup(){
		this.components.forEach(c => {
			if(c.componentType != "physics") c.removeGroup();
		});
		this.materialGroupsCount--;
	}

	setGroups(count){
		while(this.materialGroupsCount > count){
			this.removeGroup();
		}
		while(this.materialGroupsCount < count){
			this.addGroup();
		}
	}
}

/**
 * Represents a list of RenderGroups - one group per material.
 */
class RenderComponent{
	constructor(level, componentType){
		this.level = level;
		this.componentType = componentType;

		/** 
		 * Physics group will always be an array of 1 element.
		 * @type {RenderGroup[]} 
		 * */
		this.materialGroups = [];

		// There it is.
		if(this.componentType == "physics"){
			this.addGroup();
		}
	}

	render(model){
		this.materialGroups.forEach(g => {
			g.render(model);
		});
	}

	addGroup(){
		this.materialGroups.push(new RenderGroup(this, this.level, this.componentType, this.materialGroups.length));
	}

	removeGroup(){
		this.materialGroups.pop();
	}
}

/**
 * Represents a list of vertices and UVs for a specific group inside a RenderComponent.
 */
class RenderGroup{
	/**
	 * 
	 * @param {*} level 
	 * @param {*} componentType 
	 * @param {*} materialNumber 
	 */
	constructor(component, level, componentType, materialNumber){
		this.component = component;
		this.level = level;
		this.componentType = componentType;
		this.materialNumber = materialNumber;
		// TODO: Probably don't need these two vars anymore.
		//this.vertices = [];
		//this.uvs = [];
		// this.indices = []; // TODO: use indices to reduce the size of the mesh.

		/**
		 * @type {Triangle[]} 
		 */
		this.triangles = [];
		this.renderedVertices = null;
		this.renderedUvs = null;
	}

	/**
	 * 
	 * @param {Building} model The model.
	 */
	render(model){
		this.reset();

		let levelsToRender = [];
		if(this.level == -1) for(let i = 0; i < model.levels.length; i++) levelsToRender.push(i);
		else levelsToRender.push(this.level);

		for(let i = 0; i < levelsToRender.length; i++){
			let lNumb = levelsToRender[i];
			let level = model.levels[lNumb];
			if(this.component.componentType == "floors" || this.component.componentType == "all"){
				// Tile tops: 
				this.cycleCollection(level._tileTopBoxes, (coord1, coord2)=>{
					this.square(coord1.x1, coord1.top, coord2.z2, coord2.x2, coord1.top, coord1.z1);
				});
				
				// Tile bottoms: 
				this.cycleCollection(level._tileBottomBoxes, (coord1, coord2)=>{
					this.square(coord1.x1, coord1.bottom, coord1.z1, coord2.x2, coord1.bottom, coord2.z2);
				});

				// Tile norths:
				this.cycleCollection(level._tileNorthBoxes, (coord1, coord2)=>{
					this.square(coord2.x2, coord1.bottom, coord1.z1, coord1.x1, coord1.top, coord1.z1);
				}); 

				// Tile souths: 
				this.cycleCollection(level._tileSouthBoxes, (coord1, coord2)=>{
					this.square(coord1.x1, coord1.bottom, coord2.z2, coord2.x2, coord2.top, coord2.z2);
				}); 

				// Tile easts:
				this.cycleCollection(level._tileEastBoxes, (coord1, coord2)=>{
					this.square(coord2.x2, coord1.bottom, coord2.z2, coord2.x2, coord1.top, coord1.z1);
				});  

				// Tile wests: 
				this.cycleCollection(level._tileWestBoxes, (coord1, coord2)=>{
					this.square(coord1.x1, coord1.bottom, coord1.z1, coord1.x1, coord1.top, coord2.z2);
				}); 

			}

			if(this.component.componentType == "walls" || this.component.componentType == "all"){
				// TODO: this call all be refactored. It's all repeated code.

				this.renderWallFacesAndPortals(level, false);

				// Wall north edges:
				this.cycleCollection(level._northWallEdgeBoxes, (coord1, coord2)=>{
					this.square(coord1.x1i, coord1.bottom, coord1.z1o, coord1.x1o, coord1.wallTop, coord1.z1o);
				}); 

				// Wall east edges:
				this.cycleCollection(level._eastWallEdgeBoxes, (coord1, coord2)=>{
					this.square(coord1.x2o, coord1.bottom, coord1.z1i, coord1.x2o, coord1.wallTop, coord1.z1o);
				}); 

				// Wall south edges:
				this.cycleCollection(level._southWallEdgeBoxes, (coord1, coord2)=>{
					this.square(coord1.x1o, coord1.bottom, coord1.z2o, coord1.x1i, coord1.wallTop, coord1.z2o);
				}); 

				// Wall west edges:
				this.cycleCollection(level._westWallEdgeBoxes, (coord1, coord2)=>{
					this.square(coord1.x1o, coord1.bottom, coord1.z1o, coord1.x1o, coord1.wallTop, coord1.z1i);
				}); 

				// Wall top edges (H):
				this.cycleCollection(level._wallTopHBoxes, (coord1, coord2)=>{
					this.square(coord1.x1o, coord1.wallTop, coord1.z1i, coord2.x2o, coord1.wallTop, coord1.z1o);
				}); 

				// Wall bottom edges (H):
				this.cycleCollection(level._wallBottomHBoxes, (coord1, coord2)=>{
					this.square(coord1.x1o, coord1.bottom, coord1.z1o, coord2.x2o, coord1.bottom, coord1.z1i);
				}); 

				// Wall top edges (V):
				this.cycleCollection(level._wallTopVBoxes, (coord1, coord2)=>{
					this.square(coord1.x1i, coord1.wallTop, coord1.z1o, coord1.x1o, coord1.wallTop, coord2.z2o);
				}); 

				// Wall bottom edges (V):
				this.cycleCollection(level._wallBottomVBoxes, (coord1, coord2)=>{
					this.square(coord1.x1o, coord1.bottom, coord1.z1o, coord1.x1i, coord1.bottom, coord2.z2o);
				}); 

				// Windows and doors:
				level._portalWalls.forEach(w => {
					let rimMaterial = w.outerMaterialIndex == w.innerMaterialIndex ? w.innerMaterialIndex : getDefaultMaterial();
					if(rimMaterial == this.materialNumber){
						let coord = this.getDrawDimsForTile(w.tile);
						if(w.label == "left"){
							if(coord.leftPortal.hasTop) this.square(coord.x1o, coord.leftPortal.portalTop, coord.leftPortal.portalNorth, coord.x1i, coord.leftPortal.portalTop, coord.leftPortal.portalSouth);
							if(coord.leftPortal.hasBottom) this.square(coord.x1i, coord.leftPortal.portalBottom, coord.leftPortal.portalNorth, coord.x1o, coord.leftPortal.portalBottom, coord.leftPortal.portalSouth);
							if(coord.leftPortal.hasNorth) this.square(coord.x1i, coord.leftPortal.portalTop, coord.leftPortal.portalNorth, coord.x1o, coord.leftPortal.portalBottom, coord.leftPortal.portalNorth);
							if(coord.leftPortal.hasSouth) this.square(coord.x1o, coord.leftPortal.portalTop, coord.leftPortal.portalSouth, coord.x1i, coord.leftPortal.portalBottom, coord.leftPortal.portalSouth);
						}
						else if(w.label == "top"){
							if(coord.topPortal.hasTop) this.square(coord.topPortal.portalLeft, coord.topPortal.portalTop, coord.z1o, coord.topPortal.portalRight, coord.topPortal.portalTop, coord.z1i);
							if(coord.topPortal.hasBottom) this.square(coord.topPortal.portalLeft, coord.topPortal.portalBottom, coord.z1i, coord.topPortal.portalRight, coord.topPortal.portalBottom, coord.z1o);
							if(coord.topPortal.hasEast) this.square(coord.topPortal.portalLeft, coord.topPortal.portalTop, coord.z1o, coord.topPortal.portalLeft, coord.topPortal.portalBottom, coord.z1i);
							if(coord.topPortal.hasWest) this.square(coord.topPortal.portalRight, coord.topPortal.portalTop, coord.z1i, coord.topPortal.portalRight, coord.topPortal.portalBottom, coord.z1o);
						}
					}
				});
			}

			if(this.component.componentType == "roofs" || this.component.componentType == "all"){
				level.roofs.forEach(r => {
					if(r.materialIndex == this.materialNumber){
						this.drawRoof(r, false);
					}
				});
			}

			if(this.component.componentType == "physics"){
				// Tile tops: 
				this.cycleCollection(level._pTileTopBoxes, (coord1, coord2)=>{
					this.square(coord1.x1, coord1.top, coord2.z2, coord2.x2, coord1.top, coord1.z1);
				});
				
				// Tile bottoms: 
				this.cycleCollection(level._pTileBottomBoxes, (coord1, coord2)=>{
					this.square(coord1.x1, coord1.bottom, coord1.z1, coord2.x2, coord1.bottom, coord2.z2);
				});

				// Walls:
				this.renderWallFacesAndPortals(level, true);

				Roofs:
				level.roofs.forEach(r => {
					this.drawRoof(r, true);
				});
			}
		}

		this.compile();
	}

	cycleCollection(boxRegion, callback){
		let collection = boxRegion.collections[this.materialNumber];
		if(collection){
			for(let c in collection){
				let region = collection[c];
				let coord1 = this.getDrawDimsForTile(region.startTile);
				let coord2 = this.getDrawDimsForTile(region.endTile);
				callback(coord1, coord2);
			}
		}
	}

	renderWallFacesAndPortals(level, isPhysics){
		let southBoxes = isPhysics ? level._pWallSouthBoxes : level._wallSouthBoxes;
		let northBoxes = isPhysics ? level._pWallNorthBoxes : level._wallNorthBoxes;
		let eastBoxes = isPhysics ? level._pWallEastBoxes : level._wallEastBoxes;
		let westBoxes = isPhysics ? level._pWallWestBoxes : level._wallWestBoxes;

		// Wall souths: 
		this.cycleCollection(southBoxes, (coord1, coord2)=>{
			if(!coord1.tile.top || !coord1.tile.top.hasPortal){
				this.square(coord1.x1o, coord1.bottom, coord1.z1i, coord2.x2o, coord1.wallTop, coord1.z1i);
			}
			else{

				// Top box:
				if(coord1.topPortal.hasTop) this.square(coord1.x1o, coord1.topPortal.portalTop, coord1.z1i, coord1.x2o, coord1.wallTop, coord1.z1i);
				// Bottom box:
				if(coord1.topPortal.hasBottom) this.square(coord1.x1o, coord1.bottom, coord1.z1i, coord1.x2o, coord1.topPortal.portalBottom, coord1.z1i);
				// Left box:
				if(coord1.topPortal.hasEast) this.square(coord1.topPortal.portalLeft, coord1.topPortal.portalTop, coord1.z1i, coord1.x1o, coord1.topPortal.portalBottom, coord1.z1i);
				// Right box:
				if(coord1.topPortal.hasWest) this.square(coord1.x2o, coord1.topPortal.portalTop, coord1.z1i, coord1.topPortal.portalRight, coord1.topPortal.portalBottom, coord1.z1i);
			}
		}); 
		
		// Wall norths:
		this.cycleCollection(northBoxes, (coord1, coord2)=>{
			if(!coord1.tile.top || !coord1.tile.top.hasPortal){
				this.square(coord2.x2o, coord1.bottom, coord1.z1o, coord1.x1o, coord1.wallTop, coord1.z1o);
			}
			else{
				// Top box:
				if(coord1.topPortal.hasTop) this.square(coord1.x2o, coord1.topPortal.portalTop, coord1.z1o, coord1.x1o, coord1.wallTop, coord1.z1o);
				// Bottom box:
				if(coord1.topPortal.hasBottom) this.square(coord1.x2o, coord1.bottom, coord1.z1o, coord1.x1o, coord1.topPortal.portalBottom, coord1.z1o);
				// Left box:
				if(coord1.topPortal.hasEast) this.square(coord1.topPortal.portalLeft, coord1.topPortal.portalBottom, coord1.z1o, coord1.x1o, coord1.topPortal.portalTop, coord1.z1o);
				// Right box:
				if(coord1.topPortal.hasWest) this.square(coord1.x2o, coord1.topPortal.portalBottom, coord1.z1o, coord1.topPortal.portalRight, coord1.topPortal.portalTop, coord1.z1o);
			}
		});

		// Wall wests: 
		this.cycleCollection(westBoxes, (coord1, coord2)=>{
			if(!coord1.tile.left || !coord1.tile.left.hasPortal){
				this.square(coord1.x1o, coord1.bottom, coord1.z1o, coord1.x1o, coord1.wallTop, coord2.z2o);
			}
			else{
				// Top box:
				if(coord1.leftPortal.hasTop) this.square(coord1.x1o, coord1.wallTop, coord1.z2o, coord1.x1o, coord1.leftPortal.portalTop, coord1.z1o);
				// Bottom box:
				if(coord1.leftPortal.hasBottom) this.square(coord1.x1o, coord1.leftPortal.portalBottom, coord1.z2o, coord1.x1o, coord1.bottom, coord1.z1o);
				// N box:
				if(coord1.leftPortal.hasNorth) this.square(coord1.x1o, coord1.leftPortal.portalBottom, coord1.z1o, coord1.x1o, coord1.leftPortal.portalTop, coord1.leftPortal.portalNorth);
				// S box:
				if(coord1.leftPortal.hasSouth) this.square(coord1.x1o, coord1.leftPortal.portalBottom, coord1.leftPortal.portalSouth, coord1.x1o, coord1.leftPortal.portalTop, coord1.z2o);
			}
		}); 
		
		// Wall easts: 
		this.cycleCollection(eastBoxes, (coord1, coord2)=>{
			if(!coord1.tile.left || !coord1.tile.left.hasPortal){
				this.square(coord1.x1i, coord1.bottom, coord2.z2o, coord1.x1i, coord1.wallTop, coord1.z1o);
			}
			else{
				// Top box:
				if(coord1.leftPortal.hasTop) this.square(coord1.x1i, coord1.leftPortal.portalTop, coord1.z2o, coord1.x1i, coord1.wallTop, coord1.z1o);
				// Bottom box:
				if(coord1.leftPortal.hasBottom) this.square(coord1.x1i, coord1.bottom, coord1.z2o, coord1.x1i, coord1.leftPortal.portalBottom, coord1.z1o);
				// E box:
				if(coord1.leftPortal.hasNorth) this.square(coord1.x1i, coord1.leftPortal.portalBottom, coord1.leftPortal.portalNorth, coord1.x1i, coord1.leftPortal.portalTop, coord1.z1o);
				// W box:
				if(coord1.leftPortal.hasSouth) this.square(coord1.x1i, coord1.leftPortal.portalBottom, coord1.z2o, coord1.x1i, coord1.leftPortal.portalTop, coord1.leftPortal.portalSouth);
			}
		});
	}

	/**
	 * 
	 * @param {Roof} roof The roof.
	 */
	drawRoof(roof, isPhysics){
		let level = roof.level;
		let b = level.building;
		let ts = b.tileSize;
		let x0 = -b.w / 2;
		let z0 = -b.h / 2;
		let wt = b.wallThickness;
		let ft = level.floorThickness;
		let s = b.roofSlope;

		let xai = (x0 + roof.x1 - 0.5) * (ts + wt);
		let zai = (z0 + roof.y1 - 0.5) * (ts + wt);
		let xbi = (x0 + roof.x2 + 0.5) * (ts + wt);
		let zbi = (z0 + roof.y2 + 0.5) * (ts + wt);

		let xa = xai - ft / s;
		let za = zai - ft / s;
		let xb = xbi + ft / s;
		let zb = zbi + ft / s;

		let dx = Math.abs(xa - xb);
		let dz = Math.abs(za - zb);
		let dmin = Math.min(dx, dz);
		let dmax = Math.max(dx, dz);
		let hcalc = s * dmin;

		let ya = level._ch + 0.001;
		let yb = ya + hcalc;
		let yc = Math.min(yb, ya + b.roofHeight);

		let x2a = xa + (yc - ya);
		let x2b = xb - (yc - ya);
		let z2a = za + (yc - ya);
		let z2b = zb - (yc - ya);

		let drawNorthFace = false;
		let drawEastFace = false;
		let drawSouthFace = false;
		let drawWestFace = false;

		// BLOCKING WALLS
		//TODO: The result from this next section could be cached to miniimze processor resources for each render.

		for(let x = roof.x1; x <= roof.x2; x++){
			if(!level.tiles[roof.y1][x].top.filled){
				drawNorthFace = true;
				break;
			}
		}
		if(!drawNorthFace) {
			za += ft / s;
			z2a = za;
		}
		
		
		for(let x = roof.x1; x <= roof.x2; x++){
			if(!level.tiles[roof.y2 + 1][x].top.filled){
				drawSouthFace = true;
				break;
			}
		}
		if(!drawSouthFace) {
			zb -= ft / s;
			z2b = zb;
		}

		for(let z = roof.y1; z <= roof.y2; z++){
			if(!level.tiles[z][roof.x1].left.filled){
				drawWestFace = true;
				break;
			}
		}
		if(!drawWestFace) {
			xa += ft / s;
			x2a = xa;
		}
		
		
		for(let z = roof.y1; z <= roof.y2; z++){
			if(!level.tiles[z][roof.x2 + 1].left.filled){
				drawEastFace = true;
				break;
			}
		}
		if(!drawEastFace) {
			xb -= ft / s;
			x2b = xb;
		}
		
		// TRIANGLES / TRAPAZOIDS

		let va = ya / s / 1.414;
		let vb = yc / s / 1.414;

		
		if(drawWestFace){
			this.twoWayTriangle(new Triangle(
				new Vertex(xa, ya, za, za, va),
				new Vertex(xa, ya, zb, zb, va),
				new Vertex(x2a, yc, z2a, z2a, vb)
			));
			if(z2a != z2b){
				this.twoWayTriangle(new Triangle(
					new Vertex(x2a, yc, z2b, z2b, vb),
					new Vertex(x2a, yc, z2a, z2a, vb),
					new Vertex(xa, ya, zb, zb, va)
				));
			}
		}
		
		if(drawEastFace){
			this.twoWayTriangle(new Triangle(
				new Vertex(xb, ya, za, za, va),
				new Vertex(x2b, yc, z2a, z2a, vb),
				new Vertex(xb, ya, zb, zb, va)
			));
			if(z2a != z2b){
				this.twoWayTriangle(new Triangle(
					new Vertex(x2b, yc, z2b, z2b, vb),
					new Vertex(xb, ya, zb, zb, va),
					new Vertex(x2b, yc, z2a, z2a, vb)
				));
			}
		}

		if(drawNorthFace){
			this.twoWayTriangle(new Triangle(
				new Vertex(xa, ya, za, xa, va),
				new Vertex(x2a, yc, z2a, x2a, vb),
				new Vertex(xb, ya, za, xb, va)
			));
			if(x2a != x2b){
				this.twoWayTriangle(new Triangle(
					new Vertex(x2b, yc, z2a, x2b, vb),
					new Vertex(xb, ya, za, xb, va),
					new Vertex(x2a, yc, z2a, x2a, vb)
				));
			}
		}
		
		if(drawSouthFace){
			this.twoWayTriangle(new Triangle(
				new Vertex(xa, ya, zb, xa, va),
				new Vertex(xb, ya, zb, xb, va),
				new Vertex(x2a, yc, z2b, x2a, vb)
			));
			if(x2a != x2b){
				this.twoWayTriangle(new Triangle(
					new Vertex(x2b, yc, z2b, x2b, vb),
					new Vertex(x2a, yc, z2b, x2a, vb),
					new Vertex(xb, ya, zb, xb, va)
				));
			}
		}

		// CLIPPED TOP
		/*let clippedTop = yc < yb
		|| (!drawSouthFace && !drawEastFace)
		|| (!drawSouthFace && !drawWestFace)
		|| (!drawNorthFace && !drawEastFace)
		|| (!drawNorthFace && !drawWestFace);*/
		let clippedTop = x2a != x2b || z2a != z2b;
		if(clippedTop){
			this.twoWayTriangle(new Triangle(
				new Vertex(x2a, yc, z2a, x2a, z2a),
				new Vertex(x2b, yc, z2b, x2b, z2b),
				new Vertex(x2b, yc, z2a, x2b, z2a)
			));

			this.twoWayTriangle(new Triangle(
				new Vertex(x2a, yc, z2b, x2a, z2b),
				new Vertex(x2b, yc, z2b, x2b, z2b),
				new Vertex(x2a, yc, z2a, x2a, z2a)
			));
		}

		// BOTTOM RIM
		if(!isPhysics){
			if(drawSouthFace) this.square(xb, ya, zb, xa, ya, zbi);
			if(drawNorthFace) this.square(xb, ya, zai, xa, ya, za);
			if(drawEastFace) this.square(xa, ya, zai, xai, ya, zbi);
			if(drawWestFace) this.square(xbi, ya, zai, xb, ya, zbi);

			// INNER CLIFF
			if(drawEastFace) this.square(xai, ya, zbi, xai, ya + ft/s, zai);
			if(drawWestFace) this.square(xbi, ya, zai, xbi, ya + ft/s, zbi);
			if(drawNorthFace) this.square(xai, ya, zai, xbi, ya + ft/s, zai);
			if(drawSouthFace) this.square(xbi, ya, zbi, xai, ya + ft/s, zbi);

			// SMALL EDGE TRIANGLES
			if(drawSouthFace && !drawEastFace) this.twoWayTriangle(new Triangle(
				new Vertex(xb, ya, zb, zb, ya),
				new Vertex(xb, ya, zbi, zbi, ya),
				new Vertex(xb, ya + (ft) / s, zbi, zbi, ya + (ft) / s)
			));
			if(drawSouthFace && !drawWestFace) this.twoWayTriangle(new Triangle(
				new Vertex(xa, ya, zb, zb, ya),
				new Vertex(xa, ya, zbi, zbi, ya),
				new Vertex(xa, ya + (ft) / s, zbi, zbi, ya + (ft) / s)
			));
			if(drawNorthFace && !drawEastFace) this.twoWayTriangle(new Triangle(
				new Vertex(xb, ya, za, za, ya),
				new Vertex(xb, ya, zai, zai, ya),
				new Vertex(xb, ya + (ft) / s, zai, zai, ya + (ft) / s)
			));
			if(drawNorthFace && !drawWestFace) this.twoWayTriangle(new Triangle(
				new Vertex(xa, ya, za, za, ya),
				new Vertex(xa, ya, zai, zai, ya),
				new Vertex(xa, ya + (ft) / s, zai, zai, ya + (ft) / s)
			));
			
			if(drawEastFace && !drawSouthFace) this.twoWayTriangle(new Triangle(
				new Vertex(xb, ya, zb, xb, ya),
				new Vertex(xbi, ya, zb, xbi, ya),
				new Vertex(xbi, ya + (ft) / s, zb, xbi, ya + (ft) / s)
			));
			
			if(drawEastFace && !drawNorthFace) this.twoWayTriangle(new Triangle(
				new Vertex(xb, ya, za, xb, ya),
				new Vertex(xbi, ya, za, xbi, ya),
				new Vertex(xbi, ya + (ft) / s, za, xbi, ya + (ft) / s)
			));
			
			if(drawWestFace && !drawSouthFace) this.twoWayTriangle(new Triangle(
				new Vertex(xa, ya, zb, xb, ya),
				new Vertex(xai, ya, zb, xbi, ya),
				new Vertex(xai, ya + (ft) / s, zb, xbi, ya + (ft) / s)
			));
			
			if(drawWestFace && !drawNorthFace) this.twoWayTriangle(new Triangle(
				new Vertex(xa, ya, za, xa, ya),
				new Vertex(xai, ya, za, xai, ya),
				new Vertex(xai, ya + (ft) / s, za, xai, ya + (ft) / s)
			));
		}
	}

	reset(){
		//this.vertices = [];
		//this.uvs = [];
		//this.indices = [];

		this.triangles = [];
	}
	compile(){
		let vCount = this.triangles.length * 3;
		this.renderedVertices = new Float32Array(vCount * 3);
		this.renderedUvs = new Float32Array(vCount * 2);
		this.triangles.forEach((t, i) => {
			this.renderedVertices[i * 9 + 0] = t.v1.x;
			this.renderedVertices[i * 9 + 1] = t.v1.y;
			this.renderedVertices[i * 9 + 2] = t.v1.z;
			this.renderedUvs[i * 6 + 0] = t.v1.u;
			this.renderedUvs[i * 6 + 1] = t.v1.v;
			
			this.renderedVertices[i * 9 + 3] = t.v2.x;
			this.renderedVertices[i * 9 + 4] = t.v2.y;
			this.renderedVertices[i * 9 + 5] = t.v2.z;
			this.renderedUvs[i * 6 + 2] = t.v2.u;
			this.renderedUvs[i * 6 + 3] = t.v2.v;
			
			this.renderedVertices[i * 9 + 6] = t.v3.x;
			this.renderedVertices[i * 9 + 7] = t.v3.y;
			this.renderedVertices[i * 9 + 8] = t.v3.z;
			this.renderedUvs[i * 6 + 4] = t.v3.u;
			this.renderedUvs[i * 6 + 5] = t.v3.v;
		});
	}

	//Only works for standard geometry not joined.
	addVertex(x,y,z,u,v){
		throw "Not using this anymore. Add triangles instead.";
		if(this.geometry){
			//Need to update in real time.
			this.geometry.attributes.position.array[this.vertices.length * 3] = x;
			this.geometry.attributes.position.array[this.vertices.length * 3 + 1] = y;
			this.geometry.attributes.position.array[this.vertices.length * 3 + 2] = z;
			this.geometry.attributes.position.needsUpdate = true;
			this.geometry.attributes.uv.array[this.uvs.length * 2] = u;
			this.geometry.attributes.uv.array[this.uvs.length * 2 + 1] = v;
			this.geometry.attributes.uv.needsUpdate = true;
			this.geometry.setDrawRange( 0, (this.vertices.length + 1) * 3 - 1 );
		}

		this.vertices.push([x,y,z]);
		this.uvs.push([u,v]);
		//console.log(this.vertices.length);
	}

	join(others){
		this.reset();
		others.forEach((v, i) => {
			this.vertices = this.vertices.concat(v.vertices);
			this.uvs = this.uvs.concat(v.uvs);
			this.indices = this.indices.concat(v.indices);
		});
        let geometry = this.compile();
        
        let start = 0;

		return geometry;
	}

	square(x1, y1, z1, x2, y2, z2){
		this.minx = Math.min(this.minx, x1, x2);
		this.miny = Math.min(this.miny, z1, z2);
		this.maxx = Math.max(this.maxx, x1, x2);
		this.maxy = Math.max(this.maxy, z1, z2);
		let dx = (x2 - x1);
		let dy = (y2 - y1);
		let dz = (z2 - z1);
		let x0 = x1;
		let y0 = y1;
		let z0 = z1;
		let u0, u1, u2, u3, v0, v1, v2, v3;
		if(dy == 0){
			u0 = x0;
			v0 = z0 + dz; //0
			u1 = x0 + dx;
			v1 = z0 + dz; //1
			u2 = x0 + dx;
			v2 = z0; //2
			u3 = x0;
			v3 = z0; //3
		}
		else{
			u0 = dx ? x0 : z0;
			v0 = y0 + dy; //0
			u1 = dx ? x0 + dx : z0 + dz;
			v1 = y0 + dy; //1
			u2 = dx ? x0 + dx : z0 + dz;
			v2 = y0; //2
			u3 = dx ? x0 : z0;
			v3 = y0; //3
		}
		this.triangle(new Triangle(
			new Vertex(x1, y2, y1 == y2 ? z2 : z1, u0, v0),
			new Vertex(x2, y1, y1 == y2 ? z1 : z2, u2, v2),
			new Vertex(x2, y2, z2, u1, v1)
		));
		this.triangle(new Triangle(
			new Vertex(x1, y2, y1 == y2 ? z2 : z1, u0, v0),
			new Vertex(x1, y1, z1, u3, v3),
			new Vertex(x2, y1, y1 == y2 ? z1 : z2, u2, v2)
		));
	}
	/**
	 * 
	 * @param {Triangle} t 
	 */
	triangle(t){
		this.triangles.push(t);
	}

	/**
	 * 
	 * @param {Triangle} t The triangle to add.
	 */
	twoWayTriangle(t){
		this.triangle(t);
		this.triangle(t.flip());
	}

	getTilePos(tile){
		let b = tile.level.building;
		let wt = b.wallThickness;
		let ts = b.tileSize;
		let s = wt + ts;
		let x0 = -b.w / 2;
		let z0 = -b.h / 2;
		let xi = x0 + tile.x;
		let zi = z0 + tile.y;
		return {
			x: xi * (ts + wt) - (ts * 0.5) - wt,
			z: zi * (ts + wt) - (ts * 0.5) - wt
		};
	}

	/**
	 * 
	 * @param {Tile} tile 
	 */
	getDrawDimsForTile(tile){
		let b = tile.level.building;
		let wt = b.wallThickness;
		let ts = b.tileSize;
		let s = wt + ts;
		let coords = this.getTilePos(tile);
		let ret = {};
		ret.tile = tile;
		ret.x = coords.x;
		ret.z = coords.z;
		ret.y0O = 0;
		ret.y1O = 0;
		ret.y2O = 0;
		ret.s = s;
		ret.wt = wt;
		// ret.x1 = (tile.west && tile.west.filled) || tile.left.filled ? ret.x + wt : ret.x;
		// ret.x2 = ret.x + s + (tile.east && tile.east.left.filled && ! (tile.east && tile.east.filled) ? 0 : wt);
		// ret.z1 = (tile.north && tile.north.filled) || tile.top.filled ? ret.z + wt : ret.z;
		// ret.z2 = ret.z + s + (tile.south && tile.south.top.filled && !(tile.south && tile.south.filled) ? 0 : wt);
		
		// Edge coords.
		
		let wth = wt * 0.5;
		ret.x1 = ret.x + wth;
		ret.x2 = ret.x + s + wth;
		ret.z1 = ret.z + wth;
		ret.z2 = ret.z + s + wth;

		// Wall coords.
		
		ret.x1i = ret.x + wt;
		ret.x1o = ret.x;
		ret.x2i = ret.x + ts;
		ret.x2o = ret.x + s + wt;

		ret.z1i = ret.z + wt;
		ret.z1o = ret.z;
		ret.z2i = ret.z + ts;
		ret.z2o = ret.z + s + wt;


		// Height coords.

		ret.top = tile.level._gl;
		ret.bottom = tile.level._ch;
		ret.wallTop = tile.level._cl;

		// Portal info.
		ret.leftPortal = null;
		ret.topPortal = null;
		if(tile.left && tile.left.hasPortal){
			let pInfo = {};
			pInfo.portalTop = Math.min(ret.wallTop, ret.wallTop - 0.6);
			pInfo.portalBottom = Math.max(ret.bottom, ret.bottom);//  + 0.2;
			pInfo.portalNorth = Math.max(ret.z1, ret.z1 + 0.2);
			pInfo.portalSouth = Math.min(ret.z2, ret.z2 - 0.2);
			pInfo.hasBottom = pInfo.portalBottom != ret.bottom;
			pInfo.hasTop = pInfo.portalTop != ret.wallTop;
			pInfo.hasNorth = pInfo.portalNorth != ret.z1;
			pInfo.hasSouth = pInfo.portalSouth != ret.z2;
			ret.leftPortal = pInfo;
		}
		if(tile.top && tile.top.hasPortal){
			let pInfo = {};
			pInfo.portalTop = Math.min(ret.wallTop, ret.wallTop - 0.6);
			pInfo.portalBottom = Math.max(ret.bottom, ret.bottom);// + 0.2;
			pInfo.portalLeft = Math.max(ret.x1, ret.x1 + 0.2);
			pInfo.portalRight = Math.min(ret.x2, ret.x2 - 0.2);
			pInfo.hasBottom = pInfo.portalBottom != ret.bottom;
			pInfo.hasTop = pInfo.portalTop != ret.wallTop;
			pInfo.hasWest = pInfo.portalWest != ret.x1;
			pInfo.hasEast = pInfo.portalEast != ret.x2;
			ret.topPortal = pInfo;
		}

		return ret;
	}

	/**
	 * TODO: probably don't need this...
	 * @param {Wall} w 
	 */
	getWallDrawSpecs(w){
		let ret;
		if(w.label == "left"){
			ret = {
				lcw: w.tile.west && w.tile.west.top.filled, // Clockwise wall.
				ls: w.tile.north && w.tile.north.left.filled, // Adjacent wall.
				lccw: w.tile.top.filled, // Counter clockwise wall.
				rcw: w.tile.south && w.tile.south.top.filled, // Clockwise wall from right.
				rs: w.tile.south && w.tile.south.left.filled, // Adgacent wall to the right.
				rccw: w.tile.south && w.tile.south.west && w.tile.south.west.top.filled, // Counter clockwile wall from right.
			};
		}
		else{
			ret = {
				lcw: w.tile.north && w.tile.north.left.filled, // CW left.
				ls: w.tile.west && w.tile.west.top.filled, // Straight left.
				lccw: w.tile.left.filled, // CCW left.
				rcw: w.tile.east && w.tile.east.left.filled, // CW right.
				rs: w.tile.east && w.tile.east.top.filled, // Straight right.
				rccw: w.tile.east && w.tile.east.north && w.tile.east.north.left.filled // CCW righgt.
			};
		}
		let coords = this.getTilePos(w.tile);
		ret.tx = coords.x; // Tile X.
		ret.tz = coords.z; // Tile Z.
		ret.w = w; // The actual wall.
		ret.t = w.tile; // The tile.
		ret.b = w.tile.level.building; // The building.
		ret.wt = ret.b.wallThickness; // Wall thickness.
		ret.ts = ret.b.tileSize; // Tile width.
		ret.s = ret.wt + ret.ts; // Total tile size (tile + wall).
		ret.dm = Math.min(w.innerMaterialIndex, w.outerMaterialIndex); // Dominant material
		ret.bx0 = ret.ls || ret.lccw ? ret.wt : 0; // 
		ret.tx0 = ret.ls || ret.lcw ? ret.wt : 0;
		ret.bx1 = ret.s + (ret.rcw ? 0 : ret.wt);
		ret.tx1 = ret.s + (ret.rccw ? 0 : ret.wt);
		return ret;
	}
}

class Vertex{
	/**
	 * A textured vertex in space.
	 * @param {Number} x X coordinate value.
	 * @param {Number} y Y coordinate value.
	 * @param {Number} z Z coordinate value.
	 * @param {Number} u U UV map value.
	 * @param {Number} v V UV map value.
	 */
	constructor(x, y, z, u, v){
		this.x = x;
		this.y = y;
		this.z = z;
		this.u = u;
		this.v = v;
	}
}

class Triangle{
	/**
	 * Defines a triangle with three vertices.
	 * @param {Vertex} v1 Vertex 1.
	 * @param {Vertex} v2 Vertex 2.
	 * @param {Vertex} v3 Vertex 3.
	 */
	constructor(v1, v2, v3){
		this.v1 = v1;
		this.v2 = v2;
		this.v3 = v3;
	}

	/**
	 * Gets a new triangle with the same vertices facing the opposite direction.
	 */
	flip(){
		return new Triangle(this.v1, this.v3, this.v2);
	}
}

function disposeAll(){

	allGroups.forEach(g => g.reset());
	if(lightHiddenGeometry) lightHiddenGeometry.reset();
	if(previewGeometry) previewGeometry.reset();
	if(collisionGeometry) collisionGeometry.reset();
	if(wireframeGeometry) wireframeGeometry.reset();
}

function clearFaces(object, prefix){
	let parent = object["_" + prefix + "source"] || object;
	//console.log("_" + prefix + "faces");
	//console.log(parent["_" + prefix + "faces"]);
	let faces = parent["_" + prefix + "faces"];
	//console.log("deleting shit.");
	while(faces.length > 0){
		let face = faces.pop();
		let faceI = geometry.faces.indexOf(face);
		//console.log(faceI);
		delete geometry.faces[faceI];
		delete geometry.faceVertexUvs[0][faceI];
		geometry.faces.splice(faceI, 1);
		geometry.faceVertexUvs[0].splice(faceI, 1);
	}

	parent["_" + prefix + "drawn"] = false;
	while(parent["_" + prefix + "children"].length > 0){
		let child = parent["_" + prefix + "children"].pop();
		child["_" + prefix + "drawn"] = false;
		child["_" + prefix + "source"] = null;
	}
}

/**
 * TODO: this whole thing sholud be retired.
 * @param {Wall} w 
 * @param {Number} y0 
 * @param {Number} y1 
 * @param {Number} y2 
 */
function drawWall(w, y0, y1, y2){
	let optimizations = true;
	let sw = w.label == "left";
	let b = w.tile.level.building;
	let wt = b.wallThickness;
	if(w.filled){
		let wp = getWallDrawSpecs(w);
		let x = wp.x;
		let z = wp.z;
		let s = wp.s;
		
		//Faces:
		let bx0 = wp.bx0;
		let tx0 = wp.tx0;
		let bx1 = wp.bx1;
		let tx1 = wp.tx1;
		let dir = sw ? "z" : "x";
		let coords = {x: x, z: z};
		let e = wp;

		let level = w.tile.level.levelNumber;
		let gOut = magicGroupPicker("wall", allGroups[w.outerMaterialIndex], level);
		let gIn = magicGroupPicker("wall", allGroups[w.innerMaterialIndex], level);
		let gDm = magicGroupPicker("wall", allGroups[wp.dm], level);
		let gB = magicGroupPicker("wall", allGroups[w.bottomMaterialIndex], level);

		if(!w.hasPortal && w.windowIndex == -1){
			let noDoorOrWindow = function(wp){return !wp.w.hasPortal && wp.w.windowIndex == -1};
			if(!w._odrawn){
				if(optimizations) e = expandTile(w.tile, w.label, getWallDrawSpecs, "outerMaterialIndex", "o", sw ? "south" : "east", null, null, null, null, dir, noDoorOrWindow);
				let displacement = (e[dir] - coords[dir]);
				swapsquare(gOut, sw, x, z, displacement + e.tx1, y0, 0, e.tx0, y2, 0);
			}
			if(!w._idrawn){
				if(optimizations) e = expandTile(w.tile, w.label, getWallDrawSpecs, "innerMaterialIndex", "i", sw ? "south" : "east", null, null, null, null, dir, noDoorOrWindow);
				let displacement = (e[dir] - coords[dir]);
				swapsquare(gIn, sw, x, z, e.bx0, y0, wt, displacement + e.bx1, y2, wt);
			}
			
		}
		else{
			//Note: this script was originally built for doors in mind, but was adapted to include windows. Hence the let names.
			let ww = w.windowIndex == -1 || w.windowIndex >= b.myWindows.length ? null : b.myWindows[w.windowIndex];
			let db = y1 + (ww ? ww.bottom : 0); // Door bottom.
			let dh = db + (ww ? ww.height : 2); //Door height level.

			//top area
			swapsquare(gOut, sw, x, z, tx1, dh, 0,  tx0, y2, 0);
			swapsquare(gIn, sw, x, z, bx0, dh, wt, bx1, y2, wt);

			//bottom area

			let dw = ww ? ww.width : 1.2; //door width.
			let dxo = (b.tileSize - dw) / 2; //door x offset.
			let dx1 = wt + dxo;
			let dx2 = dx1 + dw;
			//left area
			swapsquare(gOut, sw, x, z, dx1, db, 0,  tx0, dh, 0);
			swapsquare(gIn, sw, x, z, bx0, db, wt, dx1, dh, wt);

			//right area
			swapsquare(gOut, sw, x, z, tx1, db, 0, dx2, dh, 0);
			swapsquare(gIn, sw, x, z, dx2, db, wt, bx1, dh, wt);

			//Inner surfaces
			swapsquare(gDm, sw, x, z, dx1, dh, 0, dx2, dh, wt);
			swapsquare(gDm, sw, x, z, dx1, db, wt, dx1, dh, 0);
			swapsquare(gDm, sw, x, z, dx2, db, 0, dx2, dh, wt);

			//Bottom part.
			if(!(w.tile.filled && w.adjt && w.adjt.filled) || db != y1){ 
				if(w.adjt){ // Fixes an obscure bug.
					let dfl = db == y1 ? ((w.tile.filled && !w.adjt.filled) ? w.tile.floorMaterialIndex : ( (!w.tile.filled && w.adjt.filled) ? w.adjt.floorMaterialIndex : null)) : null;
					if(dfl !== null) dfl = magicGroupPicker("wall", allGroups[dfl], level);
					swapsquare(dfl || gDm, sw, x, z, dx1, db, wt, dx2, db, 0); //top
				}
				swapsquare(gOut, sw, x, z, tx1, y0, 0,  tx0, db, 0); //front
				swapsquare(gIn, sw, x, z, bx0, y0, wt, bx1, db, wt); //back

			}
		}

		//Drawing the wall edges.
		if(!wp.ls && bx0 == tx0) swapsquare(gDm, sw, x, z, bx0, y0, 0, tx0, y2, wt);
		if(!wp.rs && bx1 == tx1) swapsquare(gDm, sw, x, z, bx1, y0, wt, tx1, y2, 0);
		//let dmName = w? "innerMaterialIndex" : "outerMaterialIndex";
		if(!w._tdrawn){
			if(optimizations) e = expandTile(w.tile, w.label, getWallDrawSpecs, "domMaterialIndex", "t", sw ? "south" : "east", null, null, null, null, dir, null);
			let displacement = (e[dir] - coords[dir]);
			//swapsquare(w.outerMaterialIndex, sw, x, z, displacement + e.tx1, y0, 0, e.tx0, y2, 0);
			swapsquare(gDm, sw, x, z, displacement + Math.max(bx1, tx1), y2, 0, Math.min(bx0, tx0), y2, wt); // on top //TODO: extend if it's a + intersection.
		}
		//Bottom part.
		let drawBottom = function(wp){return !(wp.tile.filled && w.adjt && wp.w.adjt.filled);};
		if(!w._bdrawn && !(w.tile.filled && w.adjt && w.adjt.filled)){ 
			if(optimizations) e = expandTile(w.tile, w.label, getWallDrawSpecs, "bottomMaterialIndex", "b", sw ? "south" : "east", null, null, null, null, dir, drawBottom);
			let displacement = (e[dir] - coords[dir]);
			swapsquare(gB, sw, x, z, displacement + Math.max(bx1, tx1), y0, wt, Math.min(bx0, tx0), y0, 0); // on bottom - doors have different bottoms.//TODO: extend if it's a + intersection.

		}
	}
}

// Setup an event listener that will handle messages sent to the worker.
self.addEventListener('message', function(e) {
	let data = e.data;
	if((data instanceof Array) && data.length >= 1){
		let command = data[0];
		// Load 
		switch(command){
			case "loadfile":{ // Load the save file into the internal model.
				let fileContent = data[1];
				model.loadJson(JSON.parse(fileContent));
				editorSegments = [];
				for(let i = 0; i < model.levels.length; i++) addLevel();
				break;
			}
			case "clearbuilding":{
				model = new Building();
				editorSegments = [];
				break;
			}
			case "renderall":{ // Render the whole building in parts. Called after loading a file, or changing view settings. Multiple callbacks.
				let exportMode = data[1];
				if(exportMode){
					renderLevel(-1);
				}
				else{
					for(let i = 0; i < model.levels.length; i++){
						renderLevel(i);
					}
				}
				break;
			}
			case "renderlevel":{ 
				let level = data[1];
				renderLevel(level);
				break;
			}
			case "setgroups":{
				groupCount = data[1];
				exportSegment.setGroups(groupCount);
				editorSegments.forEach(s => {
					s.setGroups(groupCount);
				});
				break;
			}
			case "drawtiles":{
				let level = data[1];
				let x1 = data[2];
				let y1 = data[3];
				let x2 = data[4];
				let y2 = data[5];
				let fill = data[6];
				let tMaterial = data[7];
				let bMaterial = data[8];
				let wMaterial = data[9];
				model.levels[level].paintTiles(x1, y1, x2, y2, fill, tMaterial, bMaterial, wMaterial);
				renderLevel(level);
				break;
			}
			case "drawwalls":{
				let level = data[1];
				let wallMode = data[2]; // 1 = north, 2 = west, 3 = NE-SW, 4 = NW-SE
				let x1 = data[3];
				let y1 = data[4];
				let x2 = data[5];
				let y2 = data[6];
				let fill = data[7];
				let iMaterial = data[8];
				let oMaterial = data[9];
				model.levels[level].paintWalls(wallMode, x1, y1, x2, y2, fill, iMaterial, oMaterial);
				renderLevel(level);
				break;
			}
			case "setdoor":{
				let level = data[1];
				let x = data[2];
				let y = data[3];
				let isTop = data[4]; // true = top wall
				let fill = data[5];
				(model.levels[level].tiles[y][x])[isTop ? "top" : "left"].hasPortal = fill;
				renderLevel(level);
				break;
			}
			case "addroof":{
				let level = data[1];
				let x1 = data[2];
				let y1 = data[3];
				let x2 = data[4];
				let y2 = data[5];
				let material = data[6];
				//console.log(level);
				model.levels[level].addRoof(x1, y1, x2, y2, material);
				renderLevel(level);
				break;
			}
			case "removeroof":{
				let level = data[1];
				let x = data[2];
				let y = data[3];
				model.levels[level].removeRoof(x, y);
				renderLevel(level);
				break;
			}
			case "addlevel":{
				model.addLevel();
				addLevel();
				break;
			}
			default:{
				console.error("Invalid webworker command:", command);
			}
		}
	}
	else{
		throw "Message type not recognized.";
	}
}, false);

function addLevel(){
	let segment = new RenderSegment(editorSegments.length);
	segment.setGroups(groupCount);
	editorSegments.push(segment);
}

function renderLevel(level){
	let segment;
	if(level == -1){
		// Render preview / export model.
		for(let i = 0; i < model.levels.length; i++) model.levels[i].updateBoxes(true);
		segment = exportSegment;
	}
	else{
		// Normal render segments.
		model.levels[level].updateBoxes(false);
		segment = editorSegments[level];
	}

	// Rendering and postback.
	segment.render(model);
	segment.components.forEach((c, i) => {
		//console.log(C);
		c.materialGroups.forEach((g, j) => {
			if(g.renderedVertices && g.renderedVertices.length > 0) console.log(`${g.renderedVertices.length} vertices found on level ${level}, component ${i}, group ${j}.`);
			self.postMessage(g.renderedVertices);
			if(c.componentType != "physics") self.postMessage(g.renderedUvs);
		});
	});
}

// Constants
const wallSurfaces = ["i", "o", "t", "b"];
//const tileSurfaces = ["fl", "b", "te", "le", "re", "be"];

// Vars
var minx, miny, maxx, maxy;
var model = new Building();
var exportSegment = new RenderSegment(-1); // One segment for the whole building.
/** @type {RenderSegment[]} */
var editorSegments = []; // One segment per level.
var groupCount = 0;