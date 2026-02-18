import win32com.client
import pythoncom
import json
import sys
import os

def executar_automacao_ppci(dados_json):
    try:
        # Inicialização do ambiente COM para evitar erros de Threading
        pythoncom.CoInitialize()
        
        dados = json.loads(dados_json)
        
        # Conexão com a instância ativa do AutoCAD
        try:
            acad = win32com.client.GetActiveObject("AutoCAD.Application")
            doc = acad.ActiveDocument
            ms = doc.ModelSpace
            print(f"Conectado ao documento: {doc.Name}")
        except Exception as e:
            print("Erro: AutoCAD não encontrado ou nenhum desenho aberto.")
            return

        # Posição inicial para o grid de equipamentos
        x_atual = 0.0
        y_atual = 0.0
        
        # Lista para armazenar dados para a legenda posterior
        resumo_legenda = []

        # 1. LOOP DE DESENHO DOS EQUIPAMENTOS
        for item in dados['itens']:
            nome = item['tipo']
            cor = item['cor']
            qtd = item['quantidade']
            
            if qtd <= 0: continue

            resumo_legenda.append({"nome": nome, "cor": cor, "qtd": qtd})

            # Gerenciamento de Layers
            nome_layer = f"PPCI_{nome.replace(' ', '_')}"
            try:
                layer = doc.Layers.Add(nome_layer)
                layer.color = cor
            except:
                layer = doc.Layers.Item(nome_layer)

            for i in range(qtd):
                # Cria ponto de inserção
                ponto = win32com.client.VARIANT(pythoncom.VT_ARRAY | pythoncom.VT_R8, (x_atual, y_atual, 0.0))
                
                # Desenha o Círculo (Símbolo)
                circulo = ms.AddCircle(ponto, 10.0) 
                circulo.Layer = nome_layer
                
                # Adiciona o Texto de Identificação
                texto_id = f"{nome[:3].upper()}-{i+1}"
                txt_obj = ms.AddText(texto_id, ponto, 5.0)
                txt_obj.Layer = nome_layer

                # Move para a direita no grid
                x_atual += 50.0 
            
            # Reseta X e desce Y para a próxima categoria
            x_atual = 0.0
            y_atual -= 100.0

        # 2. GERAÇÃO DA LEGENDA AUTOMÁTICA
        gerar_quadro_legenda(doc, ms, resumo_legenda)

        # 3. ATUALIZAÇÃO E ZOOM
        doc.Regen(1)
        doc.SendCommand("_ZOOM _E ")

        # 4. EXPORTAÇÃO AUTOMÁTICA PARA PDF
        gerar_pdf_projeto(doc)

        print("Processo concluído: Desenho, Legenda e PDF gerados com sucesso.")

    except Exception as e:
        print(f"Erro Crítico no Python: {e}")
    finally:
        pythoncom.CoUninitialize()

def gerar_quadro_legenda(doc, ms, resumo):
    """Cria uma tabela de legenda no canto do projeto"""
    if not resumo: return

    x_legenda = 600.0 # Posiciona à direita do grid principal
    y_legenda = 0.0
    espacamento = 30.0

    # Título do Quadro
    p_titulo = win32com.client.VARIANT(pythoncom.VT_ARRAY | pythoncom.VT_R8, (x_legenda, y_legenda + 40, 0.0))
    titulo = ms.AddText("LEGENDA DE EQUIPAMENTOS (ACORREA GESTÃO)", p_titulo, 15.0)
    titulo.color = 7 

    for info in resumo:
        p_simbolo = win32com.client.VARIANT(pythoncom.VT_ARRAY | pythoncom.VT_R8, (x_legenda, y_legenda, 0.0))
        p_texto = win32com.client.VARIANT(pythoncom.VT_ARRAY | pythoncom.VT_R8, (x_legenda + 30, y_legenda - 5, 0.0))
        
        # Símbolo na legenda
        circ = ms.AddCircle(p_simbolo, 8.0)
        circ.color = info['cor']
        
        # Texto descritivo
        label = f"{info['qtd']}un - {info['nome']}"
        ms.AddText(label, p_texto, 10.0)
        
        y_legenda -= espacamento

def gerar_pdf_projeto(doc):
    try:
        layout = doc.ActiveLayout
        layout.ConfigName = "DWG To PDF.pc3"
        layout.PlotType = 1 
        layout.StandardScale = 0 
        layout.CenterPlot = True

        if doc.FullName:
            pdf_path = doc.FullName.lower().replace(".dwg", ".pdf")
            # Adicionamos o comando de Plot
            doc.Plot.PlotToFile(pdf_path)
            
            # LOG IMPORTANTE: O Electron precisa ler isso para saber que acabou
            print(f"FILE_PATH_PDF:{pdf_path}")
            return pdf_path
    except Exception as e:
        print(f"Erro ao gerar PDF: {e}")
        return None

if __name__ == "__main__":
    # Suporte para receber caminho de arquivo ou string JSON direta
    if len(sys.argv) > 1:
        entrada = sys.argv[1]
        if os.path.isfile(entrada) and entrada.endswith('.json'):
            with open(entrada, 'r', encoding='utf-8') as f:
                dados_prontos = f.read()
            executar_automacao_ppci(dados_prontos)
        else:
            executar_automacao_ppci(entrada)
    else:
        print("Uso: python pycad_worker.py <caminho_json_ou_string>")