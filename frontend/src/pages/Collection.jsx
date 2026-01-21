import { useEffect, useState, useRef } from "react";
import { Box, Typography, TextField, IconButton, LinearProgress, Button, Tooltip, Badge } from "@mui/material";
import { 
    ArrowBack, 
    ArrowForward, 
    Home as HomeIcon,
    CheckCircle as CheckIcon,
    Map as MapIcon,
    Warning as WarningIcon
} from "@mui/icons-material";
import axios from "axios";
import QuestionnaireSelector from "../components/QuestionnaireSelector";
import PageHeader from "../components/PageHeader";
import InterviewMapDialog from "../components/InterviewMapDialog"; // Novo Componente

const API = "https://survey-platform-sc3c.onrender.com";

export default function Collection() {
  const [view, setView] = useState('grid');
  const [selected, setSelected] = useState(null);
  const [interview, setInterview] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [maxInterview, setMaxInterview] = useState(1);
  const [inputNumber, setInputNumber] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Controle do Modal de Mapa
  const [mapOpen, setMapOpen] = useState(false);
  const [mapData, setMapData] = useState([]);

  const inputRefs = useRef({});
  const navigationLock = useRef(false); // Trava apenas para navegação, não para salvar dados

  const handleSelectQuestionnaire = async (q) => {
    setSelected(q); 
    setLoading(true);
    try {
        const lastRes = await axios.get(`${API}/collection/${q.id}/last`);
        const lastNumber = lastRes.data.last || 1;
        setMaxInterview(lastNumber);
        await loadInterview(q.id, lastNumber);
        setView('collection');
    } catch (error) { console.error("Erro", error); } finally { setLoading(false); }
  };
  
  const backToGrid = () => { setInterview(null); setSelected(null); setView('grid'); };

  // Carrega o status para o mapa
  const fetchMapData = async () => {
      try {
          const res = await axios.get(`${API}/collection/${selected.id}/status_map`);
          setMapData(res.data);
          setMapOpen(true);
      } catch (e) { console.error(e); }
  };

  const loadInterview = async (qid, number) => {
      const num = parseInt(number);
      if (num < 1) return;
      
      setLoading(true);
      navigationLock.current = false;
      
      try {
        const res = await axios.get(`${API}/collection/${qid}/interview/${num}`);
        setInterview(res.data.interview);
        setQuestions(res.data.questions);
        
        const rawAnswers = res.data.answers || {};
        const cleanAnswers = {};
        
        res.data.questions.forEach(q => {
            const ans = rawAnswers[q.id];
            if (ans) {
                if (q.type === "multiple_choice" && ans.option_index !== null) {
                    cleanAnswers[q.id] = String(ans.option_index + 1);
                } else {
                    cleanAnswers[q.id] = ans.text || "";
                }
            }
        });
        
        setAnswers(cleanAnswers);
        setInputNumber(String(num));
        // Se carregou um número maior que o maximo conhecido, atualiza
        if (num > maxInterview) setMaxInterview(num);
        
      } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // Foco automático
  useEffect(() => {
      if (!loading && questions.length > 0 && interview) {
          setTimeout(() => {
              const firstUnanswered = questions.find(q => !answers[q.id]);
              if (firstUnanswered) {
                  inputRefs.current[firstUnanswered.id]?.focus();
              } else {
                  inputRefs.current[questions[0].id]?.focus();
              }
          }, 50);
      }
  }, [interview, loading]); 

  // --- SAVE ANSWER CORRIGIDO ---
  // Removemos o "return" preventivo. Permitimos concorrência de salvamento para garantir
  // que se o usuário digitar rápido, todas as requisições sejam disparadas.
  const saveAnswer = async (q, forcedValue = null) => {
      const value = forcedValue !== null ? forcedValue : answers[q.id];
      if (value === undefined || value === "") return;

      let payloadText = null, payloadOptionIndex = null;
      if (q.type === "multiple_choice") {
          const intVal = parseInt(value, 10);
          if (isNaN(intVal) || intVal < 1 || intVal > q.options.length) return;
          payloadOptionIndex = intVal - 1;
      } else {
          payloadText = value;
      }

      // Verificação Local de Completude
      const currentAnswerKeys = Object.keys(answers);
      // Inclui a resposta atual na contagem se ela ainda não estava no estado
      const isAlreadyAnswered = currentAnswerKeys.includes(String(q.id));
      // Se não estava respondida, adicionamos 1. Se já estava, mantemos o length atual.
      const totalAnsweredNow = currentAnswerKeys.length + (isAlreadyAnswered ? 0 : 1);
      const isLocalComplete = totalAnsweredNow >= questions.length;

      try {
          // Dispara o salvamento sem "await" bloqueante de interface, mas "await" para lógica de navegação
          const response = await axios.post(`${API}/collection/${selected.id}/answer`, {
              interview_id: interview.id, 
              question_id: q.id, 
              text: payloadText, 
              option_index: payloadOptionIndex
          });
          
          // --- LOGICA DE AUTO-AVANÇO (CORRIGIDA) ---
          // Só avança automaticamente se:
          // 1. Estivermos na ÚLTIMA entrevista criada (não em revisão histórica)
          // 2. O questionário estiver completo
          // 3. A navegação não estiver travada
          const isAtTip = interview.number === maxInterview;
          
          if ((response.data.is_complete || isLocalComplete) && isAtTip && !navigationLock.current) {
              navigationLock.current = true; // Trava para evitar pulo duplo
              
              // Pequeno delay para feedback visual
              setTimeout(() => {
                  const nextNum = parseInt(interview.number) + 1;
                  loadInterview(selected.id, nextNum);
              }, 300);
          }
      } catch (error) { 
          console.error("Erro ao salvar:", error); 
          // Se falhar o salvamento, talvez valha a pena mostrar um toast de erro
      }
  };

  const handleAnswerChange = async (q, val) => {
      // Validação
      if (q.type === "multiple_choice") {
          if (val === "") {
              setAnswers(prev => ({ ...prev, [q.id]: val }));
              return;
          }
          const num = parseInt(val, 10);
          if (isNaN(num) || num < 1 || num > q.options.length) return;
      }

      // Atualiza visualmente
      setAnswers(prev => ({ ...prev, [q.id]: val }));
      
      // Auto-Advance Múltipla Escolha
      if (q.type === "multiple_choice") {
          const num = parseInt(val, 10);
          if (!isNaN(num) && num >= 1 && num <= q.options.length) {
              
              // 1. Salva Imediatamente (Fire and Forget para UI fluida, mas await para garantir ordem)
              // Usamos o 'val' direto do evento
              saveAnswer(q, val); 

              // 2. Move o foco
              const currentIndex = questions.findIndex(item => item.id === q.id);
              const nextQuestion = questions[currentIndex + 1];

              if (nextQuestion) {
                  inputRefs.current[nextQuestion.id]?.focus();
              } else {
                  // Última pergunta: tira o foco para evitar edições acidentais enquanto navega
                  inputRefs.current[q.id]?.blur(); 
              }
          }
      }
  };

  const handleInputKeyDown = async (e, q) => {
      if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault(); 
          const currentIndex = questions.findIndex(item => item.id === q.id);
          const nextQuestion = questions[currentIndex + 1];
          
          // Salva ao dar Enter
          saveAnswer(q, e.target.value);

          if (nextQuestion) {
              inputRefs.current[nextQuestion.id]?.focus();
          } else {
              inputRefs.current[q.id]?.blur();
          }
      }
  };

  const navigate = (delta) => {
      const currentNum = parseInt(interview.number);
      const target = currentNum + delta;
      
      // CORREÇÃO DO "FLASH": Removemos bloqueios complexos aqui.
      // A navegação manual deve ser sempre permitida, exceto se tentar ir para < 1.
      // O usuário pode querer sair de uma entrevista incompleta para voltar depois.
      if (target >= 1) {
          loadInterview(selected.id, target);
      }
  };

  const handleNumberKeyDown = (e) => {
      if (e.key === "Enter") {
          const n = parseInt(inputNumber);
          if (!isNaN(n) && n >= 1) loadInterview(selected.id, n);
      }
  };

  if (view === 'grid') {
      return (
          <Box sx={{ height: '100%', p: 0 }}>
              <PageHeader 
                  title="Coleta de Dados" 
                  subtitle="Selecione um questionário para iniciar o modo de entrevista."
              />
              <QuestionnaireSelector mode="view" onSelect={handleSelectQuestionnaire} />
          </Box>
      );
  }

  if (loading && !interview) return <Box p={3}><LinearProgress /></Box>;
  if (!interview) return null;

  const totalQs = questions.length;
  const answeredQs = Object.keys(answers).length;
  const progress = totalQs > 0 ? (answeredQs / totalQs) * 100 : 0;
  const missingCount = totalQs - answeredQs;

  return (
    <Box p={3} maxWidth="md" mx="auto">
      <Box mb={2} display="flex" justifyContent="space-between">
        <Button startIcon={<HomeIcon />} onClick={backToGrid}>Voltar</Button>
        <Button 
            variant="outlined" 
            color={missingCount > 0 ? "warning" : "success"}
            startIcon={missingCount > 0 ? <WarningIcon /> : <MapIcon />}
            onClick={fetchMapData}
        >
            Mapa de Status
        </Button>
      </Box>

      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h5" fontWeight="bold">{selected.name}</Typography>
        <Typography variant="caption" color="text.secondary">ID: {interview.id}</Typography>
      </Box>

      <Box display="flex" alignItems="center" justifyContent="center" gap={2} mt={2} mb={3} p={2} bgcolor="#f5f5f5" borderRadius={2}>
        <IconButton onClick={() => navigate(-1)} disabled={parseInt(interview.number) <= 1}><ArrowBack /></IconButton>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography>Entrevista Nº</Typography>
          <TextField value={inputNumber} size="small" sx={{ width: 80, bgcolor: 'white' }} onChange={e => setInputNumber(e.target.value)} onKeyDown={handleNumberKeyDown} />
        </Box>
        <IconButton onClick={() => navigate(1)}><ArrowForward /></IconButton>
      </Box>

      <LinearProgress value={progress} variant="determinate" sx={{ mb: 4, height: 10, borderRadius: 5 }} />

      {questions.map((q, i) => {
        const isAnswered = answers[q.id] !== undefined && answers[q.id] !== "";
        return (
            <Box 
                key={q.id} 
                mb={3} p={3} 
                border="1px solid" 
                borderColor={isAnswered ? "primary.light" : "grey.300"} 
                borderRadius={2} 
                bgcolor={isAnswered ? "#e3f2fd" : "white"}
                sx={{ transition: 'background-color 0.3s' }}
            >
                <Typography fontSize={18} gutterBottom><strong>P{i + 1}.</strong> {q.text}</Typography>
                {q.type === "multiple_choice" && (
                    <Box mt={1} mb={2} pl={0}>
                        {q.options.map((opt, idx) => {
                            const isSelected = String(answers[q.id]) === String(idx + 1);
                            return (
                                <Box key={idx} display="flex" alignItems="center" gap={1} sx={{ color: isSelected ? 'primary.main' : 'text.primary', fontWeight: isSelected ? 'bold' : 'normal', py: 0.2 }}>
                                    <Typography variant="body1"><strong>[{idx + 1}]</strong> {opt}</Typography>
                                    {isSelected && <CheckIcon fontSize="small" color="primary" />}
                                </Box>
                            );
                        })}
                    </Box>
                )}
                <Box mt={2}>
                    <TextField
                        fullWidth 
                        size={q.type === "multiple_choice" ? "small" : "medium"} 
                        sx={q.type === "multiple_choice" ? { width: 100, bgcolor: 'white' } : { bgcolor: 'white' }}
                        placeholder={q.type === "multiple_choice" ? "Opção..." : "Sua resposta..."}
                        multiline={q.type === "open"} rows={q.type === "open" ? 2 : 1}
                        inputRef={el => (inputRefs.current[q.id] = el)}
                        value={answers[q.id] || ""}
                        onChange={e => handleAnswerChange(q, e.target.value)}
                        // onBlur: Salva o estado atual (para clicks fora ou Tab)
                        onBlur={(e) => saveAnswer(q, e.target.value)}
                        onKeyDown={(e) => handleInputKeyDown(e, q)}
                    />
                </Box>
            </Box>
        );
      })}

      <InterviewMapDialog 
        open={mapOpen} 
        onClose={() => setMapOpen(false)} 
        data={mapData} 
        onNavigate={(num) => loadInterview(selected.id, num)} 
      />
    </Box>
  );
}