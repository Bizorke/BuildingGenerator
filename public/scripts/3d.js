
"use strict";

var Renderer = new (class{
	constructor(){
		this._SceneLibrary = class{
			constructor(){
				this.floorsByMaterial = {};
				this.wallsByMaterial = {};
				this.roofsByMaterial = {};
				this.buildingByMaterial = {};
				this.physics = null;
				this.physicsVisualizer = null;
			}
		}

		this._PaintQueueItem = class{
			/**
			 * 
			 * @param {number} level 
			 * @param {string} segmentTag 
			 * @param {number} materialNumb 
			 */
			constructor(level, segmentTag, materialNumb){
				this.level = level;
				this.segmentTag = segmentTag;
				this.materialNumb = materialNumb;
				this.vertices = null;
				this.uvs = null;
			}
		}

		this.controls = null;
		this.allMazeBuilderMaterials = [];

		// Meta data:

		this.totalTime = 0;

		/**
		 * @type { this._PaintQueueItem[] }
		 */
		this._paintQueue = [];
		this._textureLoadQueue = [];
		this.exportReadyCallback = null;

		this.renderWorker = new Worker("./scripts/compilemesh_ww.js");

		this.renderWorker.addEventListener('message', (e)=>{this.processData(this, e.data);}, false);

		// Scene objects

		this.scene = null;
		this.exportScene = null;
		this.grid = null;
		this.pCam = null;
		this.light = null;
		this.renderer = null;
		this.clock = null;
		this.container = null;
		this.canvasplane = null;
		this.skybox = null;
		this.tileCursor = null;
		this.allThreeMaterials = [];
		//this.allGroups = [];
		/** @type {this._SceneLibrary[]} */
		this.sceneLibraries = [];

		// Materials

		this.wireframeMaterial = new THREE.MeshBasicMaterial( { wireframe : true } );
		this.lightFadedOutMaterial = new THREE.MeshBasicMaterial( {color: 0xFFFFFF, transparent: true, opacity: 0.1} );
		this.darkFadedOutMaterial = new THREE.MeshBasicMaterial( {color: 0xAAAAAA, transparent: true, opacity: 0.05} );
		this.invisiblePhysicsMaterial = new THREE.MeshBasicMaterial( { visible: false } )
		this.wireframePhysicsMaterial = new THREE.MeshBasicMaterial( { wireframe : true, color: 0x00FFFF, wireframeLinewidth: 100 } );

		this.init();
	}

	// Input / Output

	addMaterial(material, perminant, defaultRoof, defaultWall, defaultFloor, defaultCieling){
		material.index = this.allMazeBuilderMaterials.length;
		this.allMazeBuilderMaterials.push(material);
		this._textureLoadQueue.push(material);
		if(defaultRoof) Tools3d.settings.defaultroofmaterial = material;
		if(defaultWall) Tools3d.settings.defaultwallmaterial = material;
		if(defaultFloor) Tools3d.settings.defaultfloormaterial = material;
		if(defaultCieling) Tools3d.settings.defaultcielingmaterial = material;
		//dot("#material-list-main").materialli(null, material, perminant);
		// TODO: better would be to add a function in UI to do this.
		// I'd even more prefer if the UI stuff was encapsulated from this somehow.
		// These textures should be loaded from the outside.
		dot("#secondarytool-" + Tools3d.Tools.paint).materialchooser(material, defaultRoof, defaultWall, defaultFloor, defaultCieling);
	}

	exportToObj(){
		//console.log(geometry);
		let wireframeMode = Tools3d.settings.wireframemode;
		let previewMode = Tools3d.settings.previewmode;
		Tools3d.settings.wireframemode = false;
		Tools3d.settings.previewmode = true;
		this.renderBuilding(true);
		this.exportReadyCallback = ()=>{
			this.exportReadyCallback = null;
			Tools3d.settings.wireframemode = wireframeMode;
			Tools3d.settings.previewmode = previewMode;

			// let cx = (minx + maxx) / 2;
			// let cz = (miny + maxy) / 2;
			// this.previewGeometry.geometry.translate(-cx, 0, -cz);
			let result = THREE.ExportObj(this.exportScene);
			// this.previewGeometry.geometry.translate(cx, 0, cz);
			download("model.obj", result); // TODO: maybe use the cookie name for the file name.
			while(this.exportScene.children.length > 0) this.exportScene.remove(this.exportScene.children[0]);
			// this.renderBuilding(false); // No point of re-rendering now that we have the throwaway export scene.
		}
	}

	loadFile(fileContent){
		this.removeBuildingFromScene();
		for(let i = 0; i < Tools3d.model.levels.length; i++){
			this.sceneLibraries.push(new this._SceneLibrary());
		}
		this.renderWorker.postMessage(["loadfile", fileContent]);
		this.renderBuilding(false);
	}

	clearBuilding(){
		this.removeBuildingFromScene();
		this.renderWorker.postMessage(["clearbuilding"]);
	}

	loadTextures(){
		this.renderWorker.postMessage(["setgroups", this.allMazeBuilderMaterials.length]);

		Ui.showProgressOverlay("Loading textures.");
		let materialsToLoad = this._textureLoadQueue.slice();
		this._textureLoadQueue = [];
		return Sequencr.promiseFor(0, materialsToLoad.length, (resolve, reject, i, value) => {
			if(i != materialsToLoad.length){
				//if(allGroups[i]) allGroups[i].dispose(); //This should never get hit, since we won't be re-laoding new textures.
				//self.allGroups.push(new Geometry());
				Ui.updateProgressOverlay((i + 1) / materialsToLoad.length);
				let material = materialsToLoad[i];
				let loader = new THREE.TextureLoader().load(material.texture, (texture) => {
					texture.wrapS = THREE.RepeatWrapping;
					texture.wrapT = THREE.RepeatWrapping;
					texture.repeat.set( 0.5, 0.5 );

					let thisThreeMaterial = new THREE.MeshLambertMaterial( { map : texture } );
					this.allThreeMaterials.push(thisThreeMaterial);
					resolve();
				}, undefined, (err) => {
					this.allThreeMaterials.push(null);
					console.warn(err);
					//alert("An error occurred loading a texture. Check console for printout details.");
					resolve();
					//reject(err);
				});
			}
			/*else{
				scene.add( new THREE.Mesh( geometry, self.allThreeMaterials ) );
				if(then) then();
				resolve();
			}*/

		}).then(()=>{
			Ui.hideProgressOverlay();
		});
	}

	removeBuildingFromScene(){
		while(this.sceneLibraries.length > 0){
			let library = this.sceneLibraries.pop();
			
			Object.keys(library.floorsByMaterial).forEach(o => {
				this.scene.remove(library.floorsByMaterial[o]);
			});
			Object.keys(library.wallsByMaterial).forEach(o => {
				this.scene.remove(library.wallsByMaterial[o]);
			});
			Object.keys(library.roofsByMaterial).forEach(o => {
				this.scene.remove(library.roofsByMaterial[o]);
			});
			Object.keys(library.buildingByMaterial).forEach(o => {
				this.scene.remove(library.buildingByMaterial[o]);
			});
			if(library.physics) this.scene.remove(library.physics);
			if(library.physicsVisualizer) this.scene.remove(library.physicsVisualizer);
		}
	}

	// Meta

	_prepareForLevelRender(exportMode, level){
		let materialCount = this.allThreeMaterials.length;
		this.controls.models = [];
		if(exportMode){
			for(let m = 0; m < materialCount; m++){
				this._paintQueue.push(new this._PaintQueueItem(level, "building", m));
			}
			this._paintQueue.push(new this._PaintQueueItem(level, "exportphysics", 0));
		}
		else{
			for(let m = 0; m < materialCount; m++){
				this._paintQueue.push(new this._PaintQueueItem(level, "floors", m));
			}
			for(let m = 0; m < materialCount; m++){
				this._paintQueue.push(new this._PaintQueueItem(level, "walls", m));
			}
			for(let m = 0; m < materialCount; m++){
				this._paintQueue.push(new this._PaintQueueItem(level, "roofs", m));
			}
			this._paintQueue.push(new this._PaintQueueItem(level, "physics", 0));
		}
	}

	/**
	 * 
	 * @param {_Renderer} self 
	 * @param {number[]} data 
	 */
	processData(self, data){

		// Old (applied to ALL meshess).
		/*removeMeshesFromScene();
		renderedData.graphics.forEach(g => {
			scene.add(g);
		});

		*/

		if(self._paintQueue.length == 0) throw "Paint queue length zero - unexpected draw message from web worker.";
		let next = self._paintQueue[0];
		if(!next.vertices) next.vertices = data;
		else if(!next.uvs) next.uvs = data;
		else throw "Paint queue is in an invalid state. Saturated queue item did not get shifted.";

		if(next.uvs || next.segmentTag == "physics" || next.segmentTag == "exportphysics"){
			console.log("Rendering", next.segmentTag);
			self._paintQueue.shift();

			let library = self.sceneLibraries[next.level];
			let componentsList = null;

			// Find and remove the existing item from the scene.
			if(next.segmentTag == "building" || next.segmentTag == "exportphysics"){

			}
			else if(next.segmentTag == "physics"){
				if(library.physics) self.scene.remove(library.physics); 
				if(library.physicsVisualizer) self.scene.remove(library.physicsVisualizer); 
				library.physics = null;
				library.physicsVisualizer = null;
			}
			else{
				let existing = null;
				componentsList = {
					"floors": library.floorsByMaterial,
					"walls": library.wallsByMaterial,
					"roofs": library.roofsByMaterial
				}[next.segmentTag];
				
				existing = (componentsList[next.materialNumb]);
				if(existing) self.scene.remove(existing); 
				delete componentsList[next.materialNumb];
			}

			let mesh = null;
			let material = null;

			if(next.vertices.length > 0){
				let geometry = new THREE.BufferGeometry();

				geometry.addAttribute( 'position', (new THREE.BufferAttribute( next.vertices, 3 )).setDynamic( true ) );
				if(next.uvs) geometry.addAttribute( 'uv', new THREE.BufferAttribute( next.uvs, 2 ) );
				geometry.computeVertexNormals();

				// Creating/adding the mesh.
				if(next.segmentTag == "physics"){
					// Editor mode.
					let pGeometry = (new THREE.Geometry()).fromBufferGeometry(geometry); // Ammo.js requires non buffer geometry.

					pGeometry.name = "Physics";

					if(Tools3d.settings.visualizephysics){
						material = self.wireframePhysicsMaterial;
					}
					else{
						material = self.invisiblePhysicsMaterial;
					}

					mesh = new Physijs.ConcaveMesh(
						pGeometry,
						Physijs.createMaterial(
							material,
							0.9, // high friction
							0.4 // low restitution
						),
						0 // mass
					);

					library.physics = mesh;
					self.scene.add(mesh);
					if(Tools3d.settings.visualizephysics){
						library.physicsVisualizer = new THREE.FaceNormalsHelper( mesh, 0.5, 0x00ffff, 1 );
						self.scene.add(library.physicsVisualizer);
					}
				}
				else if(next.segmentTag == "exportphysics"){
					// Export mode.
					geometry.name = "Physics";
					mesh = new THREE.Mesh(geometry, self.invisiblePhysicsMaterial);
					self.exportScene.add(mesh);
					self.exportReadyCallback();
				}
				else if(next.segmentTag == "building"){
					geometry.name = self.allMazeBuilderMaterials[next.materialNumb].name;
					material = self.allThreeMaterials[next.materialNumb];
					mesh = new THREE.Mesh(geometry, material);
					self.exportScene.add(mesh);
				}
				else{
					// Determining the material.
					material = self.allThreeMaterials[next.materialNumb];
					if(Tools3d.settings.wireframemode){
						material = self.wireframeMaterial;
					}
					else if(Tools3d.settings.filterMode && (
						next.level > Tools3d.mLevelCursor ||
						next.level == Tools3d.mLevelCursor && (
							Tools3d.settings.filterMode == 1 && next.segmentTag == "roofs" ||
							Tools3d.settings.filterMode == 2 && (next.segmentTag == "roofs" || next.segmentTag == "walls")
						)
					)){
						material = self.lightFadedOutMaterial;
					}

					geometry.name = self.allMazeBuilderMaterials[next.materialNumb].name;
					mesh = new THREE.Mesh(geometry, material);
					componentsList[next.materialNumb] = mesh;

					// Whether or not to make this a raycast collider.
					if(next.level == Tools3d.mLevelCursor && material == self.allThreeMaterials[next.materialNumb]){
						self.controls.models.push(mesh);
					}

					self.scene.add(mesh);
				}

			}

		}

	}

	init() {
		this.addMaterial(new Material("Tiles", "./textures/floortile.jpg"), false, true, false, false, false);
		this.addMaterial(new Material("Red Brick", "./textures/redbrick.jpg"), false, false, true, false, false);
		this.addMaterial(new Material("Porcelain", "./textures/porcelain.jpg"), false, false, false, true, false);
		this.addMaterial(new Material("White Stone"), true, false, false, false, true);
		this.addMaterial(new Material("Brick", "./textures/brick.jpg"), false, false, false, false, false);
		this.addMaterial(new Material("Painted Brick", "./textures/paintedbrick.jpg"), false, false, false, false, false);
		this.addMaterial(new Material("Gravel", "./textures/gravel.jpg"), false, false, false, false, false);
		this.addMaterial(new Material("Rust", "./textures/rust.jpg"), false, false, false, false, false);
		this.addMaterial(new Material("Beige Wall", "./textures/beigewall.jpg"), false, false, false, false, false);
		this.addMaterial(new Material("Beige Cieling", "./textures/beigewall.jpg"), false, false, false, false, false);
		this.addMaterial(new Material("Metal", "./textures/metal.jpg"), false, false, false, false, false);

		this.container = document.getElementById("rendered-output");
		this.container.addEventListener("click", (e) => {
			if(Tools3d.settings.previewmode) this.container.requestPointerLock();
		});

		this.clock = new THREE.Clock();

		this.renderer = new THREE.WebGLRenderer();
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( this.container.offsetWidth, this.container.offsetHeight );
		this.container.appendChild( this.renderer.domElement );

		//pCam = new THREE.Object3D();

		//let oCam = new THREE.OrthographicCamera( width / - 2, width / 2, height / 2, height / - 2, 1, 1000 );
		//scene.add( camera );
		this.scene = new Physijs.Scene();
		this.exportScene = new THREE.Scene();

		this.createCanvasPlane();

		this.skybox = new Skybox("./textures/skybox/skybox", 5000, ".jpg", ["grid"]);
		this.scene.add(this.skybox);

		this.pCam = new THREE.PerspectiveCamera( 70, this.container.offsetWidth / this.container.offsetHeight, 0.01, 20000 );
		this.pCam.rotation.order = "YXZ";


		this.light = new THREE.DirectionalLight( 0xffffff );
		this.scene.add( this.light );

		let alight = new THREE.AmbientLight( 0x404040 ); // soft white light
		this.scene.add( alight );

		//Tile cursor:
		let tilecursorG = new THREE.BoxGeometry( 1.56, 0.11, 1.56 );
		let tileCursorM = new THREE.MeshBasicMaterial( {color: 0x00ff00, transparent: true, opacity: 0.5, premultipliedAlpha: true} );
		this.tileCursor = new THREE.Mesh( tilecursorG, tileCursorM);
		//this.tileCursor.position.x = 0;
		//this.tileCursor.position.y = 0;
		//this.tileCursor.position.z = 0;
		this.tileCursor.frustumCulled = false;
		this.scene.add( this.tileCursor );
		Tools3d.tileCursor = this.tileCursor;

		this.firstPerson = new Physijs.CapsuleMesh(
			new THREE.CubeGeometry( 0.5, 1.75, 0.5 ),
			Physijs.createMaterial(
				new THREE.MeshToonMaterial({ color: 0x888888, visible: false }),
				0.999,
				0
			)
		);
		this.firstPerson.position.x = 0;
		this.firstPerson.position.y = 10;
		this.firstPerson.position.z = 50;
		this.scene.add( this.firstPerson );
		this.firstPerson.setAngularFactor( new THREE.Vector3(0,0,0) );

		this.firstPerson.add(new THREE.PointLight(0xffffff, 1, 30));
		this.scene.add(this.pCam);
		//this.pCam.position.set( 0, 0.775, 0 );
		this.pCam.position.set( 0, 10, 50 );

		this.controls = new THREE.CustomControls( this.pCam, this.container, this.scene, this.canvasplane, { startInteraction: (pt) => {
			Tools3d.startInteraction(pt);
		}, hover: (pt) => {
			Tools3d.moveInteraction(pt);
		}, endInteraction: (pt) => {
			Tools3d.completeInteraction(pt);
		}});
		//this.pCam.position.set( 0, 10, 50 );
		this.controls.movementSpeed = 20;
		this.controls.vMovementSpeed = 10;
		this.controls.rotateSpeed = 3;
		//this.controls.enabled = false;

		this.walkingControls = new WalkingControls(this.firstPerson, this.pCam, this.container, this.scene, null);
		this.walkingControls.enabled = false;

		/*window.addEventListener( 'click', onWindowClick, false );
		window.addEventListener( 'resize', onWindowResize, false );
		document.addEventListener( 'mousemove', onDocumentMouseMove, false );
		document.addEventListener( 'mouseover', onDocumentMouseMove, false );*/

		/*floatingDiv = document.getElementById("floating-div");/*document.createElement( 'div' );
		floatingDiv.className = 'floating';
		document.body.appendChild( floatingDiv );*/
		
		this.onWindowResize(this);
		window.addEventListener( 'resize', e => {this.onWindowResize(this);}, false );

		this.loadTextures().then(()=>{
			this.drawGridForBuilding();
			//reset(null, true);
			Data.reset();
			requestAnimationFrame( () => {this.animate(this);} );
		});

	}

	animate(self) {

		let delta = self.clock.getDelta();
		self.totalTime += delta;

		//pCam.position.x += ( mouseX - pCam.position.x ) * .05;
		//pCam.position.y += ( -mouseY - pCam.position.y ) * .05;
		//pCam.lookAt( scene.position );
		//pCam.rotation.z = 0;

		self.light.position.set( self.pCam.position.x, self.pCam.position.y, self.pCam.position.z ).normalize();
		self.light.rotation.set( self.pCam.rotation.x, self.pCam.rotation.y, self.pCam.rotation.z );
		//console.log(Tools3d.settings.tool);
		if({"tiles":1, "room":1, "walls":1, "door":1, "window":1, "roof":1}[Tools3d.settings.tool]) {
			// if(Tools3d.settings.filterMode == 0){
			self.tileCursor.material.opacity = 0.5 + Math.sin(self.totalTime * 4) * 0.2;
			// }
			// else{
			// 	tileCursor.transparent = false;
			// 	tileCursor.material.opacity = 1;
			// 	tileCursor.material.color.set(256 * Math.floor((0.5 + Math.sin(self.totalTime * 4) * 0.2) * 256));
			// }
		}
		else self.tileCursor.material.opacity = 0.0001;
		//console.log(tileCursor.material.color);
		if(Tools3d.settings.cursordisabled) self.tileCursor.material.color.set(0xFF0000);
		else if(Tools3d.settings.deletemode) self.tileCursor.material.color.set(0xFFAA00);
		else self.tileCursor.material.color.set(0x00FF00);
		
		self.controls.update( delta, Tools3d.settings.mouselookmode );
		self.walkingControls.update(delta);
		self.grid.position.y += (Tools3d.settings.floorheight - self.grid.position.y) * 0.1;
		self.canvasplane.position.y = self.grid.position.y;

		// Make sure user doesn't fall below 0.

		if(this.firstPerson.position.y < -10){
			self.movePlayer(Math.max(-120, Math.min(120, self.firstPerson.position.x)),5,Math.max(-120, Math.min(120, self.firstPerson.position.z)));
		}

		self.scene.simulate();
		self.renderer.render( self.scene, self.pCam );
		//grid.position.y = Tools3d.settings.floorheight;

		requestAnimationFrame( () => {self.animate(self);} );
	}

	switchToFirstPerson(){
		if(!this.controls.enabled) return;
		this.controls.enabled = false;
		this.walkingControls.enabled = true;
		let position = this.pCam.getWorldPosition(new THREE.Vector3());
		this.movePlayer(position.x, position.y - 0.75, position.z);
		//this.firstPerson.bodyMesh.position.set(position.x, position.y - 0.75, position.z);
		//this.firstPerson.__dirtyPosition = true;
		this.scene.remove(this.pCam);
		this.firstPerson.add(this.pCam);
		this.pCam.position.set(0,0.775,0);
		this.pCam.matrixWorldNeedsUpdate = true;
	}

	movePlayer(x, y, z){
		this.scene.remove(this.firstPerson);
		this.firstPerson.position.set(x,y,z);
		this.scene.add(this.firstPerson);
		this.firstPerson.setAngularFactor( new THREE.Vector3(0,0,0) );
	}

	switchToFlyingCamera(){
		if(!this.walkingControls.enabled) return;
		this.walkingControls.enabled = false;
		this.controls.enabled = true;
		let position = this.pCam.getWorldPosition(new THREE.Vector3());
		this.firstPerson.remove(this.pCam);
		this.scene.add(this.pCam);
		this.pCam.position.set(position.x, position.y, position.z);
		this.pCam.matrixWorldNeedsUpdate = true;
	}

	createCanvasPlane(){
		let wt = 1.55;
		let N = TILES_H + 1;
		let x1 = -wt*(N+1) / 2;
		let x2 = wt*(N-1) / 2;
		let y1 = -wt*(N+1) / 2;
		let y2 = wt*(N-1) / 2;
		//let planeG = new THREE.PlaneGeometry( x2-x1, y2-y1 );
		//let material = new THREE.MeshBasicMaterial( {side: THREE.DoubleSide, visible: false} );
		//this.canvasplane = new THREE.Mesh( planeG, material );

		this.canvasplane = new Physijs.BoxMesh(
			new THREE.BoxGeometry( 250, 0.01, 250 ),
			//new THREE.PlaneGeometry( 1000, 1000 ),
			Physijs.createMaterial(
				this.invisiblePhysicsMaterial,
				//new THREE.MeshLambertMaterial({ map: loader.load( 'images/rocks.jpg' ) }),
				0.9, // high friction
				0.4 // low restitution
			),
			0 // mass
		);
		//this.canvasplane.rotation.x = -Math.PI/2;
		//this.canvasplane.position.x = (x2+x1) / 2;
		//this.canvasplane.position.z = (y2+y1) / 2;
		this.scene.add(this.canvasplane);
	}

	onWindowResize(self){

		self.pCam.aspect = self.container.offsetWidth / self.container.offsetHeight;
		self.pCam.updateProjectionMatrix();
		self.renderer.setSize( self.container.offsetWidth, self.container.offsetHeight );
		self.controls.handleResize();
	}

	//Drawing lines and grids
	drawGridForBuilding(building){
		if(!this.grid){
			this.grid = new THREE.Object3D();
			let material = new THREE.LineBasicMaterial({color: 0x444444});
			let wt = building ? building.wallThickness + building.tileSize : 1.55;
			let N = TILES_H + 1;
			let x1 = -wt*(N+1) / 2;
			let x2 = wt*(N-3) / 2;
			let y1 = -wt*(N+1) / 2;
			let y2 = wt*(N-3) / 2;
			for(let i = 0; i < N; i++){
				let g = new THREE.Geometry();
				g.vertices.push(
					new THREE.Vector3(x1, -0.1, i * wt + y1),
					new THREE.Vector3(x2, -0.1, i * wt + y1)
				);
				let line = new THREE.Line(g, material);
				this.grid.add(line);
			}
			for(let i = 0; i < N; i++){
				let g = new THREE.Geometry();
				g.vertices.push(
					new THREE.Vector3(i * wt + x1, -0.1, y1),
					new THREE.Vector3(i * wt + x1, -0.1, y2)
				);
				let line = new THREE.Line(g, material);
				this.grid.add(line);
			}
			this.scene.add(this.grid);
		}
		else throw "Grid is already drawn.";
	}

	// Commands

	renderBuilding(exportMode)
	{
		for(let i = 0; i < Tools3d.model.levels.length; i++){
			this._prepareForLevelRender(exportMode, i);
		}
		this.renderWorker.postMessage(["renderall", exportMode]);
	}
	renderLevel(level)
	{
		console.log("Rerendering level", level);
		this._prepareForLevelRender(false, level);
		this.renderWorker.postMessage(["renderlevel", level]);
	}

	setFloor(filled, level, x1, y1, x2, y2, tMaterial, bMaterial, wMaterial){
		this._prepareForLevelRender(false, level);
		this.renderWorker.postMessage(["drawtiles", level, x1, y1, x2, y2, filled, tMaterial, bMaterial, wMaterial]);
	}

	setDoor(filled, level, x, y, isTop){
		this._prepareForLevelRender(false, level);
		this.renderWorker.postMessage(["setdoor", level, x, y, isTop, filled]);
	}

	setWall(filled, level, wallMode, x1, y1, x2, y2, iMaterial, oMaterial){
		this._prepareForLevelRender(false, level);
		this.renderWorker.postMessage(["drawwalls", level, wallMode, x1, y1, x2, y2, filled, iMaterial, oMaterial]);
	}

	addRoof(level, x1, y1, x2, y2, material){
		this._prepareForLevelRender(false, level);
		this.renderWorker.postMessage(["addroof", level, x1, y1, x2, y2, material]);
	}

	removeRoof(level, x, y){
		this._prepareForLevelRender(false, level);
		this.renderWorker.postMessage(["removeroof", level, x, y]);
	}

	addLevel(){
		this.sceneLibraries.push(new this._SceneLibrary());
		this.renderWorker.postMessage(["addlevel"]);
	}
});
