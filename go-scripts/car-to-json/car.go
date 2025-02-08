package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/bluesky-social/indigo/repo"
	"github.com/ipfs/go-cid"
	"github.com/ipld/go-ipld-prime/codec/dagcbor"
	"github.com/ipld/go-ipld-prime/datamodel"
	"github.com/ipld/go-ipld-prime/node/basicnode"
)

type Record struct {
	CID  string                 `json:"cid"`
	Type string                 `json:"type,omitempty"`
	Data map[string]interface{} `json:"data,omitempty"`
}

func carList(carPath string) (map[string][]Record, error) {
	ctx := context.Background()
	fi, err := os.Open(carPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open CAR file: %v", err)
	}
	defer fi.Close()

	r, err := repo.ReadRepoFromCar(ctx, fi)
	if err != nil {
		return nil, fmt.Errorf("failed to read CAR file: %v", err)
	}

	recordsByType := make(map[string][]Record)

	var processedBlocksTotal, skippedBlocksTotal int
	err = r.ForEach(ctx, "", func(k string, v cid.Cid) error {
		block, err := r.Blockstore().Get(ctx, v)
		if err != nil {
			skippedBlocksTotal++
			return nil
		}

		n := basicnode.Prototype.Any.NewBuilder()
		reader := bytes.NewReader(block.RawData())
		if err := dagcbor.Decode(n, reader); err != nil {
			skippedBlocksTotal++
			return nil
		}

		node := n.Build()
		if node.Kind() != datamodel.Kind_Map {
			skippedBlocksTotal++
			return nil
		}

		data := make(map[string]interface{})
		iter := node.MapIterator()
		for !iter.Done() {
			k, nodeVal, err := iter.Next()
			if err != nil {
				skippedBlocksTotal++
				return nil
			}

			key, _ := k.AsString()
			switch nodeVal.Kind() {
			case datamodel.Kind_String:
				data[key], _ = nodeVal.AsString()
			case datamodel.Kind_Int:
				data[key], _ = nodeVal.AsInt()
			case datamodel.Kind_Bool:
				data[key], _ = nodeVal.AsBool()
			case datamodel.Kind_Float:
				data[key], _ = nodeVal.AsFloat()
			case datamodel.Kind_Map:
				nestedData := make(map[string]interface{})
				nestedIter := nodeVal.MapIterator()
				for !nestedIter.Done() {
					nk, nv, err := nestedIter.Next()
					if err != nil {
						skippedBlocksTotal++
						return nil
					}

					nkey, _ := nk.AsString()
					switch nv.Kind() {
					case datamodel.Kind_String:
						nestedData[nkey], _ = nv.AsString()
					case datamodel.Kind_Int:
						nestedData[nkey], _ = nv.AsInt()
					case datamodel.Kind_Bool:
						nestedData[nkey], _ = nv.AsBool()
					case datamodel.Kind_Float:
						nestedData[nkey], _ = nv.AsFloat()
					}
				}
				data[key] = nestedData
			}
		}

		if typeVal, ok := data["$type"]; ok {
			typeStr := typeVal.(string)
			record := Record{
				CID:  v.String(),
				Type: typeStr,
				Data: data,
			}

			recordsByType[typeStr] = append(recordsByType[typeStr], record)
			processedBlocksTotal++
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("error iterating over CAR file: %v", err)
	}

	if processedBlocksTotal > 0 {
		fmt.Printf("Successfully processed %d blocks\n", processedBlocksTotal)
	}
	if skippedBlocksTotal > 0 {
		fmt.Printf("Skipped %d blocks due to errors\n", skippedBlocksTotal)
	}

	return recordsByType, nil
}

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run main.go <path-to-car-file>")
		return
	}
	carPath := os.Args[1]

	recordsByType, err := carList(carPath)
	if err != nil {
		fmt.Printf("Error processing CAR file: %v\n", err)
		return
	}

	var consolidatedRecords []Record
	for _, records := range recordsByType {
		consolidatedRecords = append(consolidatedRecords, records...)
	}

	outputFile := "output_all_records.json"
	jsonData, err := json.MarshalIndent(consolidatedRecords, "", "  ")
	if err != nil {
		fmt.Printf("Error marshalling consolidated JSON: %v\n", err)
		return
	}

	if err := os.WriteFile(outputFile, jsonData, 0644); err != nil {
		fmt.Printf("Error writing consolidated JSON to file %s: %v\n", outputFile, err)
		return
	}
	fmt.Printf("Saved %d total records to %s\n", len(consolidatedRecords), outputFile)

	for typeStr, records := range recordsByType {
		cleanType := strings.ReplaceAll(typeStr, ".", "_")
		outputFile := fmt.Sprintf("output_%s.json", cleanType)

		jsonData, err := json.MarshalIndent(records, "", "  ")
		if err != nil {
			fmt.Printf("Error marshalling JSON for type %s: %v\n", typeStr, err)
			continue
		}

		if err := os.WriteFile(outputFile, jsonData, 0644); err != nil {
			fmt.Printf("Error writing JSON to file %s: %v\n", outputFile, err)
			continue
		}

		fmt.Printf("Saved %d records of type %s to %s\n", len(records), typeStr, outputFile)
	}

	fmt.Println("Processing complete.")
}