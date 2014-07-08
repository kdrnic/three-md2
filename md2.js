function MD2Header()
{
	var ID;					// Magic number: "IDP2", not a proper string (no terminating character)
	var version;			// Version: must be 8
	var skinWidth;			// Texture width
	var skinHeight;			// Texture height
	var frameSize;			// Size in bytes of a frame
	
	var numberOfSkins;		// Number of skins
	var numberOfVertices;	// Number of vertices per frame
	var numberOfTexCoords;	// Number of texture coordinates
	var numberOfTriangles;	// Number of triangles
	var numberOfGlCmds;		// Number of OpenGL commands
	var numberOfFrames;		// Number of frames
	
	var offsetSkins;		// Offset skin data
	var offsetTexCoords;	// Offset texture coordinate data
	var offsetTriangles;	// Offset triangle data
	var offsetFrames;		// Offset frame data
	var offsetGlCmds;		// Offset OpenGL command data
	var offsetEnd;			// Offset end of file
}

function MD2Vertex()
{
	this.position = [0, 0, 0];
	this.normalIndexes = 0;
}

function MD2TexCoord()
{
	this.s = 0;
	this.t = 0;
}

function MD2Triangle()
{
	this.verticumIndices = [];	// Proper latin! How classy
	this.texCoordIndices = [];
}

function MD2Frame()
{
	this.scale = [0, 0, 0];						// Scale factor
	this.translation = [0, 0, 0];				// Translation vector
	this.name = "";								// Frame name
	this.vertices = [];							// struct md2_vertex_t *verts;
}   

function MD2Model(fileName)
{
	this.header = new MD2Header();
	this.skins = [];
	this.texCoords = [];
	this.triangles = [];
	this.glCmds = [];
	this.frames = [];
	
	if(typeof(fileName) == "string") this.load(fileName);
}

MD2Model.prototype.load = function (url)
{
	// Code from https://developer.mozilla.org/En/Using_XMLHttpRequest#Receiving_binary_data
	function LoadBinaryResource(url)
	{
		var request = new XMLHttpRequest();
		request.open('GET', url, false);
		request.overrideMimeType('text/plain; charset=x-user-defined');
		request.send(null);
		if(request.status != 200) return '';
		return request.responseText;
	}
	
	file = LoadBinaryResource(url);
	var view = new jDataView(file, 0, file.length, true);	// Beware: MD2 format is little endian
	
	this.header.ID = view.getUint32();
	this.header.version = view.getUint32();
	
	//if(this.header.ID != 0 || this.header.version != 8)
	var validIDStr = "IDP2";	// ID is not a proper string, lacking the null terminating character
	var validID = (validIDStr.charCodeAt(3) << 24)+(validIDStr.charCodeAt(2) << 16)+(validIDStr.charCodeAt(1) << 8)+validIDStr.charCodeAt(0);
	if((this.header.ID != validID) || (this.header.version != 8))
	{
		var idStr = String.fromCharCode((this.header.ID & 0xFF), ((this.header.ID >> 8) & 0xFF), ((this.header.ID >> 16) & 0xFF), ((this.header.ID >> 24) & 0xFF));
		console.log("Not a valid MD2 file :" + url + "\nID: " + idStr + " Expected: " + validIDStr + "\nVersion: " + this.header.version + " Expected: 8\n");
		return false;
	}
	
	this.header.skinWidth = view.getInt32();
	this.header.skinHeight = view.getInt32();
	
	this.header.frameSize = view.getInt32();
	
	this.header.numberOfSkins = view.getInt32();
	this.header.numberOfVertices = view.getInt32();
	this.header.numberOfTexCoords = view.getInt32();
	this.header.numberOfTriangles = view.getInt32();
	this.header.numberOfGlCmds = view.getInt32();
	this.header.numberOfFrames = view.getInt32();

	this.header.offsetSkins = view.getInt32();
	this.header.offsetTexCoords = view.getInt32();
	this.header.offsetTriangles = view.getInt32();
	this.header.offsetFrames = view.getInt32();
	this.header.offsetGlCmds = view.getInt32();
	this.header.offsetEnd = view.getInt32();
	
	if(file.length != this.header.offsetEnd)
	{
		console.log("Corrupted MD2 file: file size and offsetEnd do not match\n");
		return false;
	}
	
	view.seek(this.header.offsetTexCoords);
	for(var i = 0; i < this.header.numberOfTexCoords; i++)
	{
		var texCoord = new MD2TexCoord();	// skinWidth and skinHeight fields may be zero or incorrect in some exporters - therefore, one must leave the option to override them
		texCoord.s = view.getInt16();		// / this.header.skinWidth;
		texCoord.t = view.getInt16();		// / this.header.skinHeight;
		this.texCoords.push(texCoord);
	}
	
	view.seek(this.header.offsetTriangles);
	for(var i = 0; i < this.header.numberOfTriangles; i++)
	{
		triangle = new MD2Triangle();
		triangle.verticumIndices[0] = view.getInt16();
		triangle.verticumIndices[1] = view.getInt16();
		triangle.verticumIndices[2] = view.getInt16();
		triangle.texCoordIndices[0] = view.getUint16();
		triangle.texCoordIndices[1] = view.getUint16();
		triangle.texCoordIndices[2] = view.getUint16();
		this.triangles.push(triangle);
	}
	
	view.seek(this.header.offsetFrames);
	for(var f = 0; f < this.header.numberOfFrames; f++)
	{
		var frame = new MD2Frame();
		frame.scale[0] = view.getFloat32();
		frame.scale[1] = view.getFloat32();
		frame.scale[2] = view.getFloat32();
		frame.translation[0] = view.getFloat32();
		frame.translation[1] = view.getFloat32();
		frame.translation[2] = view.getFloat32();
		frame.name = view.getString(16);
		frame.name = frame.name.normalize();	// The "getString" above does not always check for the 0 terminating character
		for(var v = 0; v < this.header.numberOfVertices; v++)
		{
			var vertex = new MD2Vertex();
			vertex.position[0] = view.getUint8();
			vertex.position[1] = view.getUint8();
			vertex.position[2] = view.getUint8();
			vertex.normalIndexes = view.getUint8();
			frame.vertices.push(vertex);
		}
		this.frames.push(frame);
	}
	
	if(this.header.numberOfSkins > 0)
	{
		view.seek(this.header.offsetSkins);
		for(var i = 0; i < this.header.numberOfSkins; i++)
		{
			var skin = view.getString(64);
			this.skins.push(skin);
		}
	}
}

MD2Model.prototype.GetGeometry = function()
{
	var geometry = new THREE.Geometry();
	
	geometry.faceVertexUvs[0] = [];
	for(var i = 0; i < this.header.numberOfTriangles; i++)
	{
		var face = new THREE.Face3();
		face.a = this.triangles[i].verticumIndices[2];
		face.b = this.triangles[i].verticumIndices[1];
		face.c = this.triangles[i].verticumIndices[0];
		geometry.faces.push(face);
		geometry.faceVertexUvs[0][i] = [];
		geometry.faceVertexUvs[0][i].push(new THREE.Vector2(
			this.texCoords[this.triangles[i].texCoordIndices[2]].s / this.header.skinWidth,
			1 - (this.texCoords[this.triangles[i].texCoordIndices[2]].t / this.header.skinHeight)
		));
		geometry.faceVertexUvs[0][i].push(new THREE.Vector2(
			this.texCoords[this.triangles[i].texCoordIndices[1]].s / this.header.skinWidth,
			1 - (this.texCoords[this.triangles[i].texCoordIndices[1]].t / this.header.skinHeight)
		));
		geometry.faceVertexUvs[0][i].push(new THREE.Vector2(
			this.texCoords[this.triangles[i].texCoordIndices[0]].s / this.header.skinWidth,
			1 - (this.texCoords[this.triangles[i].texCoordIndices[0]].t / this.header.skinHeight)
		));
	}
	for(var i = 0; i < this.header.numberOfFrames; i++)
	{
		geometry.morphTargets[i] = {};
		geometry.morphTargets[i].name = this.frames[i].name;
		geometry.morphTargets[i].vertices = [];
		for(var j = 0; j < this.header.numberOfVertices; j++)
		{
			geometry.morphTargets[i].vertices.push(new THREE.Vector3(
				(this.frames[i].vertices[j].position[1] * this.frames[i].scale[1]) + this.frames[i].translation[1],
				(this.frames[i].vertices[j].position[2] * this.frames[i].scale[2]) + this.frames[i].translation[2],
				(this.frames[i].vertices[j].position[0] * this.frames[i].scale[0]) + this.frames[i].translation[0]
			));
		}
	}
	geometry.vertices = geometry.morphTargets[0].vertices;
	
	return geometry;
}