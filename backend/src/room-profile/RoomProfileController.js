const service = require("./RoomProfileService");

async function getProfile(req, res) {
  try {
    const profile = await service.getRoomProfile(req.params.id);
    if (!profile) return res.status(404).json({ error: "Room not found" });
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

async function addListingUrl(req, res) {
  try {
    const { url, channel, notes } = req.body;
    if (!url) return res.status(400).json({ error: "url is required" });
    const result = await service.addListingUrl(req.params.id, { url, channel, notes });
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

async function updateListingUrl(req, res) {
  try {
    const result = await service.updateListingUrl(req.params.id, req.params.urlId, req.body);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
}

async function setPrimaryUrl(req, res) {
  try {
    const result = await service.setPrimaryListingUrl(req.params.id, req.params.urlId);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
}

async function deleteListingUrl(req, res) {
  try {
    await service.deactivateListingUrl(req.params.id, req.params.urlId);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
}

async function updateAdminNotes(req, res) {
  try {
    const { adminNotes } = req.body;
    const result = await service.updateAdminNotes(req.params.id, adminNotes ?? null);
    res.json({ adminNotes: result.adminNotes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getProfile,
  addListingUrl,
  updateListingUrl,
  setPrimaryUrl,
  deleteListingUrl,
  updateAdminNotes,
};
