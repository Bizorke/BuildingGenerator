class WalkingControls{
	constructor(
		firstPerson,
		camera, 
		container, 
		scene, 
		events
	){
		this.enabled = true;

		this.firstPerson = firstPerson;
		this.camera = camera;
		this.container = container;
		this.scene = scene;
		this.events = events;

		this.lookSensitivity = 3;
		this.acceleration = 50;
		this.topSpeed = 10;
		this.enableFirstPersonControls = true;

		this.controls = {
			forward: false,
			reverse: false,
			left: false,
			right: false,
			jumping: false
		};

		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();
		this.down = new THREE.Vector3(0,-1,0);

		window.addEventListener( "mousemove", event => { this.onMouseMove(this, event); }, false );
		window.addEventListener( "keydown", event => {this.onKeyDown(this, event);}, false );
		window.addEventListener( "keyup", event => {this.onKeyUp(this, event);}, false );
	}

	/**
	 * 
	 * @param {WalkingControls} self 
	 * @param {MouseEvent} event 
	 */
	onMouseMove(self, event) {
		if(!self.enabled) return;
		var dxP = -(event.movementX / window.innerWidth);
		var dyP = -(event.movementY / window.innerHeight);

		self.mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
		self.mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
	
		let newYR = self.camera.rotation.y + dxP * this.lookSensitivity;
		let newXR = Math.min(Math.PI / 2.2, Math.max(-Math.PI / 2.2, self.camera.rotation.x + dyP * this.lookSensitivity));
		self.camera.rotation.set(newXR, newYR, 0);
		self.camera.__dirtyRotation = true;
	}

	/**
	 * 
	 * @param {WalkingControls} self 
	 * @param {KeyboardEvent} event 
	 */
	onKeyUp(self, event){
		switch(event.which){
			case 188: case 87: case 38: {
				self.controls.forward = false;
				break;
			}
			case 79: case 83: case 40: {
				self.controls.reverse = false;
				break;
			}
			case 65: case 37: {
				self.controls.left = false;
				break;
			}
			case 69: case 68: case 39: {
				self.controls.right = false;
				break;
			}
			case 32: {
				self.controls.jumping = false;
				break;
			}
		}
	}

	/**
	 * 
	 * @param {WalkingControls} self 
	 * @param {KeyboardEvent} event 
	 */
	onKeyDown(self, event){
		if(!self.enabled) return;
		switch(event.which){
			case 188: case 87: case 38: {
				self.controls.forward = true;
				break;
			}
			case 79: case 83: case 40: {
				self.controls.reverse = true;
				break;
			}
			case 65: case 37: {
				self.controls.left = true;
				break;
			}
			case 69: case 68: case 39: {
				self.controls.right = true;
				break;
			}
			case 32: {
				self.controls.jumping = true;
				break;
			}
		}
	}

	handleResize(){}

	update(dt){
		//console.log(this.firstPerson);
		let v = this.firstPerson._physijs.linearVelocity;
		let forward = 0;
		let right = 0;
		let xs = v.x;
		let ys = v.y;
		let zs = v.z;

		//If you are not moving up or down.
		if(Math.abs(ys) < 0.1){
			if(this.controls.forward) forward ++;
			if(this.controls.reverse) forward --;
			if(this.controls.left) right ++;
			if(this.controls.right) right --;

			if(forward && right){
				forward *= 0.707;
				right *= 0.707;
			}

			let c = Math.cos(this.camera.rotation.y);
			let s = Math.sin(this.camera.rotation.y);
			xs += (- s * forward - c * right) * this.acceleration * dt;
			zs += (s * right - c * forward) * this.acceleration * dt;

			if(!forward && !right){
				xs *= 0.9;
				zs *= 0.9;
			}

			if(xs * xs + zs * zs > this.topSpeed * this.topSpeed){
				let dn = Math.sqrt(xs*xs + zs*zs);
				xs *= this.topSpeed / dn;
				zs *= this.topSpeed / dn;
			}

			// Jumping.
			// Check that the user is jumping and yspeed is zero.
			if(this.controls.jumping){
				// Also check that the user is at ground level.
				this.raycaster.set(this.camera.getWorldPosition(new THREE.Vector3()), this.down);
				let intersects = this.raycaster.intersectObjects( this.scene.children ).filter(x => x.object.mass !== undefined);
				if(intersects && intersects.length > 0 && intersects[0].distance < 1.66){
					ys += 5;
				}
				else{
					this.controls.jumping = false;
				}
			}

			this.firstPerson.setLinearVelocity(new THREE.Vector3(xs, ys, zs));
		}


		
	}
}