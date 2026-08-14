const { google } = require('googleapis');
const stream = require('stream');

const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({ version: 'v3', auth });

async function guardarChatEnDrive(nombreUsuario, nombrePersonaje, historialChat) {
  try {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const fileName = `Chat_${nombreUsuario}_${nombrePersonaje}.json`;
    const fileContent = JSON.stringify(historialChat, null, 2);

    const bufferStream = new stream.PassThrough();
    bufferStream.end(Buffer.from(fileContent));

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: folderId ? [folderId] : [],
        mimeType: 'application/json',
      },
      media: {
        mimeType: 'application/json',
        body: bufferStream,
      },
    });

    console.log('Chat guardado exitosamente en Drive ID:', response.data.id);
    return response.data;
  } catch (error) {
    console.error('Error al guardar en Google Drive:', error);
  }
}

module.exports = { guardarChatEnDrive };
