function Material(name, texture, normal){
	this.name = name || "Unammed"
	this.texture = texture || "./textures/whitewall.jpg";
	this.normal = normal || null;
	this.index = null; //Set this after.
}