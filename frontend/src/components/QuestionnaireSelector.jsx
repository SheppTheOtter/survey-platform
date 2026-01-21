import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
    Box, Typography, Grid, TextField, InputAdornment, 
    Card, CardActionArea, IconButton, Tooltip, Chip, CircularProgress, CardActions, Divider 
} from '@mui/material';
import { 
    Search as SearchIcon, 
    Add as AddIcon, 
    Delete as DeleteIcon,
    ContentCopy as CopyIcon, 
    Edit as EditIcon, 
    CalendarToday as CalendarIcon,
    Description as DocIcon, 
    UploadFile as UploadIcon,
    FileDownload as DownloadIcon,
    Check as CheckIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { saveAs } from 'file-saver';

const API = 'https://survey-platform-sc3c.onrender.com';

export default function QuestionnaireSelector({ 
    mode = 'view', 
    onSelect, onDelete, onDuplicate, onEditName, onCreateNew,
    onClearData 
}) {
    const [items, setItems] = useState([]);
    const [searchName, setSearchName] = useState('');
    const [searchDate, setSearchDate] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [creatingLoading, setCreatingLoading] = useState(false);
    const fileInputRef = useRef(null);

    const load = async (query = '') => {
        try {
            const url = query ? `${API}/questionnaires?q=${query}` : `${API}/questionnaires`;
            const r = await axios.get(url);
            setItems(r.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { load() }, []);
    useEffect(() => { if (mode === 'manage') load(searchName); }, [mode]);
    useEffect(() => {
        const delay = setTimeout(() => load(searchName), 500);
        return () => clearTimeout(delay);
    }, [searchName]);

    const startCreating = () => { setIsCreating(true); setNewName(''); };
    const cancelCreating = () => { setIsCreating(false); setNewName(''); };
    const handleCreateConfirm = async () => {
        if (!newName.trim()) return;
        setCreatingLoading(true);
        try {
            const res = await axios.post(`${API}/questionnaires`, { name: newName });
            setIsCreating(false);
            setNewName('');
            await load(searchName);
            onSelect(res.data); 
        } catch (error) {
            console.error(error);
            alert("Erro ao criar questionário.");
        } finally {
            setCreatingLoading(false);
        }
    };
    const handleKeyDownCreate = (e) => {
        if (e.key === 'Enter') handleCreateConfirm();
        if (e.key === 'Escape') cancelCreating();
    };

    const handleExportStructure = async (q) => {
        try {
            const res = await axios.get(`${API}/questionnaires/${q.id}/export/csv`, { responseType: 'blob' });
            saveAs(res.data, `${q.name}_estrutura.csv`);
        } catch (e) { alert("Erro ao exportar"); }
    };

    const handleImportClick = () => { if(fileInputRef.current) fileInputRef.current.click(); };

    const handleFileImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append("file", file);
        try {
            await axios.post(`${API}/questionnaires/import/csv`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            load(searchName);
            alert("Importado com sucesso!");
        } catch (err) { alert("Erro ao importar CSV."); }
        e.target.value = null;
    };

    const filteredItems = items.filter(q => {
        let matchesDate = true;
        if (searchDate) {
            const qDate = q.created_at ? q.created_at.substring(0, 10) : '';
            matchesDate = qDate === searchDate;
        }
        return matchesDate;
    });

    const formatDate = (isoString) => isoString ? new Date(isoString).toLocaleDateString('pt-BR') : 'Data desc.';

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <input type="file" ref={fileInputRef} style={{display:'none'}} accept=".csv" onChange={handleFileImport} />

            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                    placeholder="Buscar questionários..."
                    size="small"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    InputProps={{
                        startAdornment: (<InputAdornment position="start"><SearchIcon color="action" fontSize="small"/></InputAdornment>),
                        sx: { bgcolor: 'white', borderRadius: 2 }
                    }}
                    sx={{ flexGrow: 1, maxWidth: 400 }}
                />
                <TextField
                    type="date"
                    size="small"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    InputProps={{ sx: { bgcolor: 'white', borderRadius: 2 } }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                    {filteredItems.length} encontrado(s)
                </Typography>
            </Box>

            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                <Grid container spacing={3} justifyContent="flex-start">
                    
                    {mode === 'manage' && !searchName && !searchDate && (
                        <Grid item xs={12} sm={6} md={4} lg={3}>
                            <Card 
                                elevation={0} 
                                sx={{ 
                                    height: 240, 
                                    border: '2px dashed #e0e0e0', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    justifyContent: 'center', 
                                    alignItems: 'center',
                                    transition: 'all 0.2s',
                                    bgcolor: isCreating ? '#fff' : 'transparent',
                                    borderColor: isCreating ? '#007fff' : '#e0e0e0',
                                    boxShadow: isCreating ? 3 : 0
                                }}
                            >
                                {isCreating ? (
                                    <Box sx={{ p: 2, width: '100%', textAlign: 'center' }}>
                                        <Typography variant="subtitle2" color="primary" gutterBottom>Novo Questionário</Typography>
                                        <TextField 
                                            autoFocus fullWidth size="small" placeholder="Nome..."
                                            value={newName} onChange={(e) => setNewName(e.target.value)}
                                            onKeyDown={handleKeyDownCreate} disabled={creatingLoading} sx={{ mb: 2 }}
                                        />
                                        <Box display="flex" justifyContent="center" gap={1}>
                                            <IconButton size="small" sx={{ bgcolor: '#e8f5e9', color: 'success.main' }} onClick={handleCreateConfirm} disabled={creatingLoading || !newName.trim()}>
                                                {creatingLoading ? <CircularProgress size={20} /> : <CheckIcon />}
                                            </IconButton>
                                            <IconButton size="small" sx={{ bgcolor: '#ffebee', color: 'error.main' }} onClick={cancelCreating} disabled={creatingLoading}>
                                                <CloseIcon />
                                            </IconButton>
                                        </Box>
                                    </Box>
                                ) : (
                                    <>
                                        <Box display="flex" gap={2}>
                                            <Tooltip title="Criar em Branco">
                                                <IconButton onClick={startCreating} sx={{ bgcolor: '#e3f2fd', '&:hover':{bgcolor:'#bbdefb'}, width: 50, height: 50 }}>
                                                    <AddIcon color="primary" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Importar CSV">
                                                <IconButton onClick={handleImportClick} sx={{ bgcolor: '#e8f5e9', '&:hover':{bgcolor:'#c8e6c9'}, width: 50, height: 50 }}>
                                                    <UploadIcon color="success" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                        <Typography variant="caption" color="text.secondary" mt={1}>Novo Questionário</Typography>
                                    </>
                                )}
                            </Card>
                        </Grid>
                    )}

                    {filteredItems.map((q) => (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={q.id}>
                            <Card 
                                elevation={1} 
                                sx={{ 
                                    height: 240, 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    position: 'relative',
                                    transition: 'box-shadow 0.2s',
                                    '&:hover': { boxShadow: 4 }
                                }}
                            >
                                <CardActionArea 
                                    sx={{ flexGrow: 1, p: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start' }} 
                                    onClick={() => onSelect(q)}
                                >
                                    <Box sx={{ width: 40, height: 40, bgcolor: '#f5f5f5', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                                        <DocIcon color="action" />
                                    </Box>
                                    <Typography variant="subtitle1" fontWeight="bold" sx={{ 
                                        height: 44, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.2, mb: 1 
                                    }}>
                                        {q.name}
                                    </Typography>
                                    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                                        <CalendarIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                        <Typography variant="caption" color="text.secondary">{formatDate(q.created_at)}</Typography>
                                    </Box>
                                    
                                    <Box display="flex" gap={1} mt={1}>
                                        <Chip 
                                            label={`${q.questions_count} perguntas`} 
                                            size="small" 
                                            sx={{ bgcolor: '#f5f5f5', fontSize: '0.7rem', height: 20 }} 
                                        />
                                        <Chip 
                                            // PADRONIZAÇÃO: "X Entrevistas"
                                            label={`${q.interviews_count} entrevistas`} 
                                            size="small" 
                                            color="primary"
                                            variant="outlined"
                                            sx={{ fontSize: '0.7rem', height: 20 }} 
                                        />
                                    </Box>
                                </CardActionArea>

                                {mode === 'manage' && (
                                    <>
                                        <Divider />
                                        <CardActions sx={{ justifyContent: 'space-between', px: 1, py: 0.5, bgcolor: '#fafafa' }}>
                                            <Box>
                                                <Tooltip title="Renomear">
                                                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEditName(q); }}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Duplicar">
                                                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDuplicate(q.id).then(() => load(searchName)); }}>
                                                        <CopyIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Baixar Estrutura CSV">
                                                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleExportStructure(q); }}>
                                                        <DownloadIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                            <Tooltip title="Excluir">
                                                <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); onDelete(q.id).then(() => load(searchName)); }}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </CardActions>
                                    </>
                                )}

                                {onClearData && (
                                    <>
                                        <Divider />
                                        <CardActions sx={{ justifyContent: 'flex-end', px: 1, py: 0.5, bgcolor: '#fafafa' }}>
                                            <Tooltip title="Apagar TODAS as entrevistas coletadas">
                                                <IconButton 
                                                    size="small" 
                                                    color="error" 
                                                    onClick={(e) => { e.stopPropagation(); onClearData(q.id).then(() => load(searchName)); }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </CardActions>
                                    </>
                                )}
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Box>
        </Box>
    );
}