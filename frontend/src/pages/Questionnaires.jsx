import React, { useState } from 'react';
import axios from 'axios';
import { 
    Box, Button, Dialog, DialogTitle, DialogContent, 
    TextField, DialogActions, IconButton, Typography, AppBar, Toolbar
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import QuestionnaireSelector from '../components/QuestionnaireSelector';
import QuestionEditor from './QuestionEditor';
import PageHeader from '../components/PageHeader'; // Novo componente

const API = 'https://survey-platform-sc3c.http://localhost:8000';

export default function Questionnaires() {
    const [view, setView] = useState('grid');
    const [selectedQ, setSelectedQ] = useState(null);
    
    // Estados para Renomear
    const [openNameDialog, setOpenNameDialog] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [targetId, setTargetId] = useState(null);

    const handleSelect = (q) => { setSelectedQ(q); setView('editor'); };
    const handleDelete = async (id) => {
        if (!window.confirm("Tem certeza? Isso apaga o questionário e todas as respostas.")) return;
        await axios.delete(`${API}/questionnaires/${id}`);
    };
    const handleDuplicate = async (id) => await axios.post(`${API}/questionnaires/${id}/duplicate`);

    const openRenameDialog = (q) => { setNameInput(q.name); setTargetId(q.id); setOpenNameDialog(true); };
    const handleSaveRename = async () => {
        if (!nameInput.trim()) return;
        try {
            await axios.put(`${API}/questionnaires/${targetId}`, { name: nameInput });
            setOpenNameDialog(false);
            window.location.reload(); 
        } catch (e) { alert("Erro ao salvar"); }
    };

    if (view === 'editor' && selectedQ) {
        return (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <AppBar position="static" color="default" elevation={0} sx={{ bgcolor: 'white', borderBottom: '1px solid #e0e0e0' }}>
                    <Toolbar variant="dense">
                        <IconButton edge="start" onClick={() => setView('grid')} sx={{ mr: 2 }}>
                            <ArrowBack />
                        </IconButton>
                        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
                            {selectedQ.id ? selectedQ.name : 'Novo Questionário'}
                        </Typography>
                    </Toolbar>
                </AppBar>
                <Box sx={{ p: 3, flexGrow: 1, overflow: 'auto', bgcolor: '#f4f6f8' }}>
                    <QuestionEditor questionnaire={selectedQ} refresh={() => {}} />
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ height: '100%', p: 0 }}>
            <PageHeader 
                title="Questionários" 
                subtitle="Crie, edite e gerencie seus modelos de pesquisa."
                // O botão de criar agora está dentro do card no Selector, então não precisamos de action aqui
                // ou poderíamos mover o botão "Criar" para cá se preferir, mas o design de Card é mais moderno.
            />
            
            <QuestionnaireSelector 
                mode="manage"
                onSelect={handleSelect}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onEditName={openRenameDialog}
            />

            <Dialog open={openNameDialog} onClose={() => setOpenNameDialog(false)}>
                <DialogTitle>Renomear Questionário</DialogTitle>
                <DialogContent>
                    <TextField autoFocus margin="dense" label="Nome" fullWidth value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenNameDialog(false)}>Cancelar</Button>
                    <Button onClick={handleSaveRename} variant="contained">Salvar</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}