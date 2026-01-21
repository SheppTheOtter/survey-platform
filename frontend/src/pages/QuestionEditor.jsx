import React, { useEffect, useState } from 'react'
import axios from 'axios'
import {
    Box, Typography, TextField, Button, Select, MenuItem,
    IconButton, Tooltip, Paper, Dialog, DialogTitle,
    DialogContent, DialogContentText, DialogActions, InputAdornment
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'

const API = 'https://survey-platform-sc3c.http://localhost:8000'

const TYPE_MAP = {
    UI_TO_API: { 'Aberta': 'open', 'Múltipla escolha': 'multiple_choice' },
    API_TO_UI: { 'open': 'Aberta', 'multiple_choice': 'Múltipla escolha' }
}

export default function QuestionEditor({ questionnaire, refresh }) {
    // Estado local para gerenciar o objeto do questionário (pois ele muda de ID null para ID real)
    const [currentQ, setCurrentQ] = useState(questionnaire)
    const [isNew, setIsNew] = useState(!questionnaire?.id)
    const [newName, setNewName] = useState('')

    const [questions, setQuestions] = useState([])
    
    // Estados do formulário de nova pergunta
    const [text, setText] = useState('')
    const [type, setType] = useState('Aberta')
    const [options, setOptions] = useState('')
    
    const [editing, setEditing] = useState(null)
    
    // Estados para Controle de Perda de Dados
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [pendingSaveData, setPendingSaveData] = useState(null)

    const load = async () => {
        if (!currentQ?.id) return
        try {
            const r = await axios.get(`${API}/questionnaires/${currentQ.id}/questions`)
            const mapped = r.data.map(q => ({
                ...q,
                type: TYPE_MAP.API_TO_UI[q.type] || 'Aberta'
            }))
            setQuestions(mapped)
        } catch (e) {
            console.error("Erro ao carregar perguntas", e)
        }
    }

    useEffect(() => { load() }, [currentQ])

    // Função para criar o questionário inicial
    const handleCreateName = async () => {
        if (!newName.trim()) return
        try {
            const res = await axios.post(`${API}/questionnaires`, { name: newName })
            setCurrentQ(res.data)
            setIsNew(false)
            refresh() // Atualiza a lista pai se necessário
        } catch (e) {
            alert("Erro ao criar questionário")
        }
    }

    const save = async (qs, force = false) => {
        if (!currentQ?.id) return
        
        const payload = qs.map((q, index) => ({
            text: q.text,
            type: TYPE_MAP.UI_TO_API[q.type],
            options: q.type === 'Múltipla escolha' 
                ? q.options.map(o => o.trim()).filter(o => o !== "") 
                : [],
            position: index
        }))

        try {
            const url = `${API}/questionnaires/${currentQ.id}/questions` + (force ? '?confirm_delete=true' : '');
            await axios.post(url, payload)
            refresh()
            if (force) {
                setConfirmOpen(false)
                setPendingSaveData(null)
            }
        } catch (error) {
            if (error.response && error.response.status === 409) {
                setPendingSaveData(qs)
                setConfirmOpen(true)
            } else {
                console.error("Erro ao salvar", error)
                alert("Erro ao salvar alterações.")
            }
        }
    }

    const confirmSaveAction = () => {
        if (pendingSaveData) save(pendingSaveData, true)
    }

    const cancelSaveAction = () => {
        setConfirmOpen(false)
        setPendingSaveData(null)
        load()
    }

    const add = async () => {
        if (!text.trim()) return
        
        const newQ = {
            text,
            type,
            options: type === 'Múltipla escolha' ? options.split('\n') : [],
            id: Date.now()
        }
        
        const newQuestions = [...questions, newQ]
        setQuestions(newQuestions)
        setText('')
        setOptions('')
        
        await save(newQuestions)
    }

    const update = (i, field, value) => {
        const qs = [...questions]
        qs[i][field] = value
        if (field === 'type' && value === 'Aberta') {
            qs[i].options = []
        }
        setQuestions(qs)
    }

    const saveEdit = async () => {
        await save(questions)
        setEditing(null)
    }

    const del = (i) => {
        const qs = questions.filter((_, x) => x !== i)
        setQuestions(qs)
        save(qs)
    }

    const dup = (i) => {
        const item = questions[i]
        const copy = { ...item, id: Date.now() }
        const qs = [...questions]
        qs.splice(i + 1, 0, copy)
        setQuestions(qs)
        save(qs)
    }

    const drag = (e) => {
        if (!e.over) return
        if (e.active.id === e.over.id) return
        
        const qs = arrayMove(questions, e.active.data.current.sortable.index, e.over.data.current.sortable.index)
        setQuestions(qs)
        save(qs)
    }

    // --- TELA DE CRIAÇÃO (SE FOR NOVO) ---
    if (isNew) {
        return (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="60vh">
                <Paper elevation={3} sx={{ p: 5, borderRadius: 3, maxWidth: 500, width: '100%', textAlign: 'center' }}>
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                        Vamos começar!
                    </Typography>
                    <Typography color="text.secondary" paragraph>
                        Dê um nome ao seu novo questionário para iniciar a criação de perguntas.
                    </Typography>
                    
                    <TextField 
                        autoFocus
                        fullWidth 
                        variant="outlined" 
                        label="Nome do Questionário" 
                        placeholder="Ex: Pesquisa de Satisfação 2024"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleCreateName()}
                        sx={{ mt: 2, mb: 3 }}
                    />

                    <Button 
                        variant="contained" 
                        size="large" 
                        fullWidth 
                        onClick={handleCreateName}
                        disabled={!newName.trim()}
                        endIcon={<ArrowForwardIcon />}
                    >
                        Criar e Editar Perguntas
                    </Button>
                </Paper>
            </Box>
        )
    }

    // --- TELA DE EDIÇÃO (SE JÁ EXISTIR) ---
    return (
        <Box>
            <Typography variant='h5' gutterBottom sx={{color: '#1976d2', fontWeight: 500}}>
                {currentQ.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{mb: 3}}>
                Arraste os itens para reordenar. Clique duas vezes para editar.
            </Typography>
            
            <Paper variant="outlined" sx={{ p: 3, bgcolor: '#f8f9fa', mb: 4, borderRadius: 2 }}>
                <Typography variant="subtitle2" gutterBottom sx={{fontWeight: 'bold'}}>ADICIONAR PERGUNTA</Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'start' }}>
                    <TextField 
                        fullWidth 
                        size="small"
                        label='Enunciado da pergunta' 
                        value={text} 
                        onChange={e => setText(e.target.value)} 
                        sx={{ bgcolor: 'white' }}
                    />
                    <Select 
                        size="small"
                        value={type} 
                        onChange={e => setType(e.target.value)}
                        sx={{ minWidth: 180, bgcolor: 'white' }}
                    >
                        <MenuItem value='Aberta'>Aberta</MenuItem>
                        <MenuItem value='Múltipla escolha'>Múltipla escolha</MenuItem>
                    </Select>
                </Box>
                {type === 'Múltipla escolha' && (
                    <TextField 
                        fullWidth 
                        multiline 
                        rows={3}
                        placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
                        label='Opções (1 por linha)' 
                        value={options} 
                        onChange={e => setOptions(e.target.value)} 
                        sx={{ mt: 2, bgcolor: 'white' }} 
                    />
                )}
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant='contained' onClick={add} disabled={!text.trim()}>
                        Adicionar à lista
                    </Button>
                </Box>
            </Paper>

            <DndContext collisionDetection={closestCenter} onDragEnd={drag}>
                <SortableContext 
                    items={questions.map((q, i) => q.id || i)} 
                    strategy={verticalListSortingStrategy}
                >
                    {questions.map((q, i) => (
                        <Paper key={q.id || i} sx={{ p: 2, mt: 2, borderLeft: '4px solid #1976d2' }} onDoubleClick={() => setEditing(i)}>
                            
                            {editing === i ? (
                                <>
                                    <Box display="flex" gap={1} mb={1}>
                                        <TextField fullWidth value={q.text} onChange={e => update(i, 'text', e.target.value)} label="Enunciado" />
                                        <Select value={q.type} onChange={e => update(i, 'type', e.target.value)}>
                                            <MenuItem value='Aberta'>Aberta</MenuItem>
                                            <MenuItem value='Múltipla escolha'>Múltipla escolha</MenuItem>
                                        </Select>
                                    </Box>
                                    
                                    {q.type === 'Múltipla escolha' && (
                                        <TextField 
                                            fullWidth 
                                            multiline 
                                            rows={3}
                                            value={q.options.join('\n')} 
                                            onChange={e => update(i, 'options', e.target.value.split('\n'))}
                                            helperText="Separe as opções por quebra de linha"
                                        />
                                    )}
                                    <Box mt={1} display="flex" gap={1}>
                                        <Button variant='contained' size="small" onClick={saveEdit}>Concluir</Button>
                                        <Button variant='text' size="small" onClick={() => {setEditing(null); load()}}>Cancelar</Button>
                                    </Box>
                                </>
                            ) : (
                                <Box display="flex" justifyContent="space-between" alignItems="start">
                                    <Box sx={{ cursor: 'grab', width: '100%' }}>
                                        <Typography variant="body1">
                                            {/* P{NUMERO} */}
                                            <strong>P{i + 1}.</strong> {q.text}
                                            <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary', bgcolor: '#eee', px: 1, borderRadius: 1 }}>
                                                {q.type}
                                            </Typography>
                                        </Typography>
                                        
                                        {q.type === 'Múltipla escolha' && (
                                            <Box mt={1} pl={0}>
                                                {/* [1] Texto */}
                                                {q.options.map((opt, idx) => (
                                                    <Typography key={idx} variant="body2" sx={{ ml: 2, color: '#444' }}>
                                                        <strong>[{idx + 1}]</strong> {opt}
                                                    </Typography>
                                                ))}
                                            </Box>
                                        )}
                                    </Box>
                                    
                                    <Box display="flex">
                                        <Tooltip title='Duplicar'><IconButton size="small" onClick={() => dup(i)}><ContentCopyIcon fontSize="small" /></IconButton></Tooltip>
                                        <Tooltip title='Excluir'><IconButton size="small" color="error" onClick={() => del(i)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                                    </Box>
                                </Box>
                            )}
                        </Paper>
                    ))}
                </SortableContext>
            </DndContext>

            <Dialog
                open={confirmOpen}
                onClose={cancelSaveAction}
            >
                <DialogTitle color="error">Atenção: Perda de Dados</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Este questionário já possui <strong>respostas coletadas</strong>.
                        <br /><br />
                        Ao salvar estas alterações, <strong>TODAS as respostas existentes serão apagadas permanentemente</strong> do banco de dados.
                        <br /><br />
                        Deseja prosseguir mesmo assim?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={cancelSaveAction} autoFocus>Cancelar</Button>
                    <Button onClick={confirmSaveAction} color="error" variant="contained">
                        Sim, apagar respostas e salvar
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}